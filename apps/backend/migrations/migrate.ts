import fs from "fs/promises";
import path from "path";
import { pool } from "./db.js";

async function migrate() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS migrations (
      id SERIAL PRIMARY KEY,
      filename TEXT UNIQUE NOT NULL,
      applied_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  const migrationDir = "./migrations";

  const files = (await fs.readdir(migrationDir))
    .filter((file) => file.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const { rows } = await pool.query(
      "SELECT 1 FROM migrations WHERE filename = $1",
      [file],
    );

    if (rows.length > 0) {
      console.log(`Skipping ${file}`);
      continue;
    }

    console.log(`Running ${file}`);

    const sql = await fs.readFile(path.join(migrationDir, file), "utf8");

    await pool.query("BEGIN");

    try {
      await pool.query(sql);
      await pool.query("INSERT INTO migrations (filename) VALUES ($1)", [file]);
      await pool.query("COMMIT");
    } catch (err) {
      await pool.query("ROLLBACK");
      console.error(err);
      throw err;
    }
  }

  await pool.end();
}

migrate().catch(console.error);
