const Database = require('better-sqlite3');

// Create or open the database file
const db = new Database('./database.db');

// Create a users table if it doesn't exist
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS lists (
    list_id INTEGER PRIMARY KEY AUTOINCREMENT,  
    title TEXT NOT NULL,
    list_order INTEGER NOT NULL
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS todos (
    todo_id INTEGER PRIMARY KEY AUTOINCREMENT, 
    list_id INTEGER NOT NULL,
    msg TEXT NOT NULL,
    todo_order INTEGER NOT NULL DEFAULT 0,
    isComplete INTEGER NOT NULL DEFAULT 0,

    FOREIGN KEY (list_id) REFERENCES lists(list_id) ON DELETE CASCADE
  )
`);

module.exports = db;
