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

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      await client.query(sql);

      await client.query("INSERT INTO migrations (filename) VALUES ($1)", [
        file,
      ]);

      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");

      console.error(err);
      throw err;
    } finally {
      client.release();
    }
  }

  await pool.end();
}

migrate().catch(console.error);
