const express = require('express');
const morgan = require('morgan');
const cors = require('cors'); // 💡 Import the cors middleware
const db = require('./db');

const app = express();
const port = 3000;

// Middleware
app.use(express.json()); // Parse JSON bodies
app.use(morgan('dev')); // Debug logger
app.use(cors());

// ROUTES ----------------------------

// Test route
app.get('/', (req, res) => {
  res.send('SQLite + Express Backend Running!');
});

// GET Single Todo
app.get('/todos/:todo_id', (req, res) => {
  const stmt = db.prepare('SELECT * FROM todos WHERE id = ?');
  const todo = stmt.get(req.params.id);
  if (!todo) {
    return res.status(404).json({ error: 'todo not found' });
  }

  res.json(todo);
});

// Insert Many Lists
app.post('/lists', (req, res) => {
  const { lists } = req.body;

  // Make sure data is correct Format
  if (!Array.isArray(lists) || lists.length === 0) {
    return res.status(400).json({ error: 'lists must be a non-empty array.' });
  }

  try {
    const insertStmt = db.prepare(
      'INSERT INTO lists (title, list_order) VALUES (?, ?)'
    );

    const getMaxOrder = db.prepare('SELECT MAX(list_order) as max FROM lists');

    const insertMany = db.transaction((lists) => {
      // Return type to front end to enable id reconciliation
      const mappings = [];

      let { max } = getMaxOrder.get();
      let nextOrder = (max || 0) + 1;

      for (const list of lists) {
        const result = insertStmt.run(list.title, nextOrder);

        mappings.push({
          tempId: list.id,
          realId: result.lastInsertRowid,
          title: list.title,
          list_order: nextOrder,
        });

        nextOrder++;
      }

      return mappings;
    });

    const response = insertMany(lists); // Call insertion function
    return res.status(201).json(response); // Return response to front end
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

// Get All Data
app.get('/data/all', (req, res) => {
  try {
    const listStmt = db.prepare('SELECT * FROM lists ORDER BY list_order ASC');
    const lists = listStmt.all();
    const todoStmt = db.prepare('SELECT * FROM todos ORDER BY todo_order ASC');
    const todos = todoStmt.all();
    res.json({ lists, todos });
  } catch (err) {
    console.error('Database error getting all data:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Get All Lists
app.get('/lists', (req, res) => {
  const stmt = db.prepare('SELECT * FROM lists');
  const lists = stmt.all();
  res.json(lists);
});

// GET ALL TODOS
app.get('/todos', (req, res) => {
  const stmt = db.prepare('SELECT * FROM todos');
  const todos = stmt.all();
  res.json(todos);
});

// INSERT MANY todos
app.post('/todos', async (req, res) => {
  const { todos, listID } = req.body;
  let parentID = Number(listID);

  if (!Array.isArray(todos) || todos.length === 0) {
    return res.status(400).json({ error: 'Todos must be a non-empty array.' });
  }
  const isCompleteValue = 0;

  try {
    const insertStmt = db.prepare(
      'INSERT INTO todos (list_id, msg, todo_order, isComplete) VALUES (?, ?, ?, ?)'
    );

    const getMaxOrder = db.prepare('SELECT MAX(todo_order) as max FROM todos');

    const insertMany = db.transaction((todos) => {
      // Return type to front end to enable id reconciliation
      const mappings = [];

      let { max } = getMaxOrder.get();
      let nextOrder = (max || 0) + 1;

      for (const todo of todos) {
        // Data to insert into table
        const result = insertStmt.run(
          parentID, // Incoming from req
          todo.msg, // incoming reqeust body
          nextOrder, // Calculated form current table
          isCompleteValue // Should default be false, grab from incoming req body
        );
        // Create array to feed back to frontend for its optimistic ID update
        mappings.push({
          tempId: todo.todoId, // Echo back the uuid temp id
          realId: result.lastInsertRowid, // The calculated unique ID or Primary Key. will. update reducer to this value
          parentID: parentID, // list id, so that we can query the proper list in our reducer
          todo_order: nextOrder, // Calculated Order number
        });

        nextOrder++;
      }

      return mappings;
    });

    const response = insertMany(todos); // Call insertion function
    return res.status(201).json(response); // Return response to front end
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});
/**
 * 
Executes a parameterized UPDATE statement on a single table row by ID.
 *
 * @param {Object} params - Configuration for the update operation.
 * @param {string} params.table - Name of the table to update (e.g. "lists", "todos").
 * @param {string} params.idColumn - Name of the ID/primary key column (e.g. "list_id").
 * @param {string|number} params.idValue - ID value used in the WHERE clause.
 * @param {string} params.field - Column name to update.
 * @param {any} params.value - New value to set for the column.
 * @returns {{ changes: number, lastInsertRowid: number }} Result of the database run call, including number of affected rows.
 */
function updateById({ table, idColumn, idValue, field, value }) {
  const stmt = db.prepare(
    `UPDATE ${table} SET ${field} = ? WHERE ${idColumn} = ?`
  );
  return stmt.run(value, idValue);
}

/**
   Creates an Express middleware that validates the presence of a required
 * field on the request body and responds with HTTP 400 if it is missing.
 *
 * Usage:
 *   app.patch('/path', requireBodyField('title'), (req, res) => { ... });
 *
 * @param {string} fieldName - Name of the required field on req.body.
 * @returns {(req: express.Request, res: express.Response, next: express.NextFunction) => void}
 *          An Express middleware function that validates the field and either
 *          sends a 400 response or calls next().
 */
function requireBodyField(fieldName) {
  return (req, res, next) => {
    const value = req.body[fieldName];
    if (value == undefined) {
      return res.status(400).json({
        error: `Missing required field: ${fieldName}.`,
      });
    }
    next();
  };
}
/**
 * Sends a 404 response if no rows were affected by a database operation.
 *
 * @param {express.Response} res - Express response object for sending HTTP response
 * @param {number} changes - Number of rows affected by DB update
 * @param {string} resourceName - Name of the table row we query (list or todo)
 * @param {number} id - Unique identifier or Primary Key
 * @returns {boolean} True if a 404 response was sent (request handled),
 * false otherwise (continue processing).
 */
function handleNotFound(res, changes, resourceName, id) {
  if (changes === 0) {
    res.status(404).json({ error: `${resourceName} with ID ${id} not found.` });
    return true; // handled
  }
  return false; // not handled
}
// Edit Lists
app.patch('/lists/:listID', requireBodyField('title'), (req, res, next) => {
  let listID = req.params.listID;
  listID = Number(listID);
  const { title } = req.body;

  try {
    const result = updateById({
      table: 'lists',
      idColumn: 'list_id',
      idValue: listID,
      field: 'title',
      value: title,
    });

    if (handleNotFound(res, result.changes, 'List', listID)) return;

    res.status(200).json({ list_id: Number(listID), title });
  } catch (err) {
    next(err); // let global error handler respond
  }
});

// UPDATE  todo.isComplete
app.patch('/todos/:todoID', requireBodyField('boolValue'), (req, res, next) => {
  let todoID = req.params.todoID;
  todoID = Number(todoID);
  const { boolValue } = req.body;

  try {
    const result = updateById({
      table: 'todos',
      idColumn: 'todo_id',
      idValue: todoID,
      field: 'isComplete',
      value: boolValue,
    });

    if (handleNotFound(res, result.changes, 'Todo', todoID)) return;

    res.status(200).json({ todo_id: Number(todoID), boolValue });
  } catch (err) {
    next(err);
  }
});

// Handle Move list order
app.put('/lists/reorder', (req, res) => {
  const { order } = req.body; // Expecting an array of list IDs, e.g., ["3", "1", "2"]

  if (!Array.isArray(order) || order.length === 0) {
    return res
      .status(400)
      .json({ error: 'order must be a non-empty array of list IDs.' });
  }

  try {
    const updateStmt = db.prepare(
      'UPDATE lists SET list_order = ? WHERE list_id = ?'
    );

    // Use a transaction to ensure all updates succeed or fail together
    const reorderTransaction = db.transaction((listIds) => {
      for (let i = 0; i < listIds.length; i++) {
        const newOrder = i + 1; // list_order is 1-based
        const listId = listIds[i];
        updateStmt.run(newOrder, listId);
      }
    });

    // Execute the transaction
    reorderTransaction(order);

    res.status(200).json({ success: true, message: 'List order updated.' });
  } catch (err) {
    console.error('Database reorder error:', err.message);
    res.status(500).json({ error: 'Failed to reorder lists.' });
  }
});

// Handle Move todo order

// Toggle Todo

/**
 * DELETE Helper Function
 * @param id : Primary Key of item to delete
 * @param tableName : which table to query
 * @param idType : either todo_id or list_id. Tells SQLite what parameter we want to query for.
 */

function runDelete(id, tableName, idType, res) {
  try {
    const stmt = db.prepare(`DELETE FROM ${tableName} WHERE ${idType} = ?`);
    const result = stmt.run(id); // synchronous

    if (result.changes === 0) {
      return res.status(404).json({
        error: `Table: ${tableName} Does not contain member with ID: ${id}`,
      });
    }

    // return staus message for frontend to process
    return res.status(204);
  } catch (err) {
    console.error('Database deletion error:', err.message);
    res.status(500).json({ error: 'Failed to delete todo item.' });
  }
}
// DELETE List via its id (consequently all of its todos)
app.delete('/lists/:listID', (req, res) => {
  let listID = req.params.listID;
  listID = Number(listID);
  return runDelete(listID, 'lists', 'list_id', res);
});

// DELETE Todo via its id
app.delete('/todos/:todoID', (req, res) => {
  const todoID = req.params.todoID;
  Number(todoID);
  return runDelete(todoID, 'todos', 'todo_id', res);
});

// START SERVER -----------------------
// app.listen(port, () => {
//   console.log(`Server listening on port ${port}`);
// });
// GOOD (Accepts connections from the local network):
app.listen(3000, '0.0.0.0', () => {
  console.log('Server Listening on port 3000\n');
  console.log('Accepting All incoming connections\n');
});
