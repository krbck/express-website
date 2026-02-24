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
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    console.log("Tables in public schema:", tableRes.rows.map(r => r.table_name));

    try {
      const msgRes = await client.query("SELECT * FROM public.messages LIMIT 1");
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

app.get("/", async (req, res) => {
  const result = await pool.query("SELECT * FROM public.messages ORDER BY id DESC");
  
  let list = result.rows.map(r => `<li>${r.message}</li>`).join("");

  res.send(`
    <h2>Send Message</h2>
    <form method="POST" action="/send">
      <input name="message" />
      <button type="submit">Send</button>
    </form>
    <h3>Messages</h3>
    <ul>${list}</ul>
  `);
});

app.post("/api/messages", async (req, res) => {
  const { message } = req.body;
  await pool.query(
    "INSERT INTO public.messages(message) VALUES($1)",
    [message]
  );
  res.sendStatus(200);
});

app.listen(3000, () => {
  console.log("Server running on 3000");
});
