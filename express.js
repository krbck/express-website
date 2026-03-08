const express = require("express");
const { Pool } = require("pg");
const Redis = require("ioredis");

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

// PostgreSQL
const pool = new Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: 5432,
});

// Redis
const CACHE_KEY = "messages:all";
const CACHE_TTL = 60; // seconds

const redis = new Redis({
  host: process.env.REDIS_HOST || "localhost",
  port: 6379,
  retryStrategy: (times) => Math.min(times * 200, 5000),
});

redis.on("connect", () => console.log("Redis connected"));
redis.on("error", (err) => console.error("Redis error:", err.message));

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
    `);
    console.log("Tables in schema:", tableRes.rows.map(r => r.table_name));

    try {
      const msgRes = await client.query("SELECT * FROM messages LIMIT 1");
      console.log("Table 'messages' exists. Sample row:", msgRes.rows[0]);
    } catch (err) {
      console.error("Table 'messages' does NOT exist or is inaccessible!", err.message);
    }

    client.release();
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

  // Invalidate cache so next GET fetches fresh data
  try { await redis.del(CACHE_KEY); } catch (err) { console.error("Redis DEL error:", err.message); }

  res.sendStatus(200);
});

// Get all messages (cache-aside)
app.get("/api/messages", async (req, res) => {
  // Try Redis cache first
  try {
    const cached = await redis.get(CACHE_KEY);
    if (cached) {
      console.log("Cache HIT");
      return res.json(JSON.parse(cached));
    }
  } catch (err) {
    console.error("Redis GET error:", err.message);
  }

  // Cache miss — query PostgreSQL
  console.log("Cache MISS — querying PostgreSQL");
  const result = await pool.query("SELECT * FROM messages ORDER BY id DESC");

  // Store in cache
  try { await redis.set(CACHE_KEY, JSON.stringify(result.rows), "EX", CACHE_TTL); } catch (err) { console.error("Redis SET error:", err.message); }

  res.json(result.rows);
});

// Delete a message
app.delete("/api/messages/:id", async (req, res) => {
  const { id } = req.params;
  await pool.query("DELETE FROM messages WHERE id=$1", [id]);

  // Invalidate cache
  try { await redis.del(CACHE_KEY); } catch (err) { console.error("Redis DEL error:", err.message); }

  res.sendStatus(200);
});

app.listen(3000, () => console.log("Server running on 3000"));

