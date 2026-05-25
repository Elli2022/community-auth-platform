import "dotenv/config";
import { ensureSchema } from "../src/app/db/migrate";

ensureSchema()
  .then(() => {
    console.log("Database schema is up to date.");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
  });
