const express = require("express");
const { Pool } = require("pg");

const app = express();
app.use(express.urlencoded({ extended: true }));

const pool = new Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: 5432,
});

app.get("/", async (req, res) => {
  const result = await pool.query("SELECT * FROM messages ORDER BY id DESC");
  
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
    "INSERT INTO messages(message) VALUES($1)",
    [message]
  );
  res.sendStatus(200);
});

app.listen(3000, () => {
  console.log("Server running on 3000");
});
