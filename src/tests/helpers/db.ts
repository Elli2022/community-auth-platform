import "dotenv/config";
import { ensureSchema } from "../../app/db/migrate";
import { usersRepository } from "../../app/component/data-access";

export async function setupTestDatabase(): Promise<void> {
  await ensureSchema();
  await usersRepository.truncateAll();
}

export async function teardownTestDatabase(): Promise<void> {
  await usersRepository.truncateAll();
}

export { usersRepository };
