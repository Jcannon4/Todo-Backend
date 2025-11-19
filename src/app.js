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

// INSERT INTO TABLE
app.post('/users', (req, res) => {
  const { name, email } = req.body;

  try {
    const stmt = db.prepare('INSERT INTO users (name, email) VALUES (?, ?)');
    const result = stmt.run(name, email);

    res.json({ success: true, id: result.lastInsertRowid });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET ONE USER
app.get('/users/:id', (req, res) => {
  const stmt = db.prepare('SELECT * FROM users WHERE id = ?');
  const user = stmt.get(req.params.id);

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  res.json(user);
});

// GET ALL USERS
app.get('/users', (req, res) => {
  const stmt = db.prepare('SELECT * FROM users');
  const users = stmt.all();
  res.json(users);
});

// INSERT INTO list TABLE
app.post('/lists', (req, res) => {
  const { title } = req.body;
  if (!title) {
    return res.status(400).json({ error: 'Title is required.' });
  }

  try {
    const maxOrderStmt = db.prepare(
      'SELECT MAX(list_order) AS max_order FROM lists'
    );
    const result = maxOrderStmt.get(); // Get the single result row
    const nextListOrder = (result.max_order || 0) + 1;
    const insertStmt = db.prepare(
      'INSERT INTO lists (title, list_order) VALUES (?, ?)'
    );
    const insertResult = insertStmt.run(title, nextListOrder);

    res.status(201).json({
      list_id: insertResult.lastInsertRowid,
      title,
      list_order: nextListOrder, // Send back the actual order used
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get Lists/full
app.get('/lists/full', async (req, res) => {
  const lists = await db.all('SELECT * FROM lists');
  //const todos = await db.all('SELECT * FROM todos ORDER BY todo_order ASC');

  res.json({ lists, todos });
});
// GET ALL List items
app.get('/lists', (req, res) => {
  const stmt = db.prepare('SELECT * FROM lists');
  const users = stmt.all();
  res.json(users);
});

// GET ALL TODOS
app.get('/todos', (req, res) => {
  const stmt = db.prepare('SELECT * FROM todos');
  const todos = stmt.all();
  res.json(todos);
});

// INSERT INTO todos TABLE
app.post('/todos', async (req, res) => {
  const { list_id, msg } = req.body;
  if (!list_id || !msg) {
    return res
      .status(400)
      .json({ error: 'Missing required fields: list_id and msg.' });
  }
  const isCompleteValue = 0;
  const sql = `
    INSERT INTO todos (list_id, msg, todo_order, isComplete)
    VALUES (?, ?, ?, ?)
  `;

  try {
    const maxOrderStmt = db.prepare(
      'SELECT MAX(todo_order) AS max_order FROM todos'
    );
    const maxResult = maxOrderStmt.get();
    const nextTodoOrder = (maxResult.max_order || 0) + 1;
    const params = [list_id, msg, nextTodoOrder, isCompleteValue];
    const stmt = db.prepare(sql);
    const result = stmt.run(params);

    // 4. Send Success Response (HTTP 201 Created)
    res.status(201).json({
      todo_id: result.lastInsertRowid,
      list_id,
      msg,
      todo_order: nextTodoOrder,
      isCompleteValue,
    });
  } catch (error) {
    console.error('Database insertion error:', error);

    // Check for specific Foreign Key Constraint error (list_id not found)
    if (error.code === 'SQLITE_CONSTRAINT_FOREIGNKEY') {
      return res
        .status(404)
        .json({ error: `List with ID '${list_id}' not found.` });
    }

    // Send generic server error response
    res.status(500).json({ error: 'Failed to create todo item.' });
  }
});

//Delete list

// START SERVER -----------------------
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
