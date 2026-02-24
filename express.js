const express = require("express");
const { Pool } = require("pg");

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const pool = new Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: 5432,
});

async function checkDB() {
  try {
    console.log("Trying to connect to DB...");
    const client = await pool.connect();
    console.log("Connection succeeded!");

    const dbRes = await client.query("SELECT current_database() AS db, current_schema AS schema");
    console.log("Connected to DB:", dbRes.rows[0].db);
    console.log("Current schema:", dbRes.rows[0].schema);

    const tableRes = await client.query(`
      SELECT table_schema, table_name 
      FROM information_schema.tables *
    `);
    console.log("Tables in schema:", tableRes.rows.map(r => r.table_name));

    try {
      const msgRes = await client.query("SELECT * FROM messages LIMIT 1");
      console.log("Table 'messages' exists. Sample row:", msgRes.rows[0]);
    } catch (err) {
      console.error("Table 'messages' does NOT exist or is inaccessible!", err.message);
    }

    client.release();
    // pool.end() <-- Kaldır
  } catch (err) {
    console.error("DB connection failed!", err.message);
  }
}

checkDB();

// Send a message
app.post("/api/messages", async (req, res) => {
  const { message } = req.body;
  if (!message || !message.trim()) return res.status(400).json({ error: "Message cannot be empty" });

  await pool.query("INSERT INTO messages(message) VALUES($1)", [message]);
  res.sendStatus(200);
});

// Get all messages
app.get("/api/messages", async (req, res) => {
  const result = await pool.query("SELECT * FROM messages ORDER BY id DESC");
  res.json(result.rows);
});

// Delete a message
app.delete("/api/messages/:id", async (req, res) => {
  const { id } = req.params;
  await pool.query("DELETE FROM messages WHERE id=$1", [id]);
  res.sendStatus(200);
});

app.listen(3000, () => console.log("Server running on 3000"));