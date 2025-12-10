Debug mode
run node --inspect app.js
Open chrome then go to Chrome://inspect
Click "Open dedicated DevTools for Node"

Thunder Client Headers
Content-Type - application/json

Body - JSON
{
"name": "Jane",
"email": "jane@example.com"
}

Remember to drop tables if you change their parametes
CLI
sqlite3 database.db
DROP TABLE IF EXISTS lists;
.quit

TO debug: run "node src/app.js"
then go to "Attach by Processs ID"

Build todo-backend executable
npx pkg .
