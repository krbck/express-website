const express = require("express");
const { Pool } = require("pg");

const app = express();
app.use(express.json());

const pool = new Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: 5432,
});

app.post("/messages", async (req, res) => {
  const { content } = req.body;

  try {
    await pool.query(
      "INSERT INTO messages (content) VALUES ($1)",
      [content]
    );
    res.status(201).send("Saved");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error");
  }
});

app.listen(3000, () => {
  console.log("Server running on 3000");
});
