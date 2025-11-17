const express = require('express');
const morgan = require('morgan');
const db = require('./db');

const app = express();
const port = 3000;

// Middleware
app.use(express.json()); // Parse JSON bodies
app.use(morgan('dev')); // Debug logger

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

// GET ALL USERS
app.get('/users', (req, res) => {
  const stmt = db.prepare('SELECT * FROM users');
  const users = stmt.all();
  res.json(users);
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

// START SERVER -----------------------
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
