import serverless from "serverless-http";
import { createApp } from "../../build/app/create-app";
import { ensureSchema } from "../../build/app/db/migrate";

const app = createApp();

let schemaReady: Promise<void> | null = null;

function prepareDatabase() {
  if (!schemaReady) {
    schemaReady = ensureSchema().catch((err) => {
      schemaReady = null;
      throw err;
    });
  }
  return schemaReady;
}

const serverlessHandler = serverless(app);

export const handler = async (
  event: Parameters<typeof serverlessHandler>[0],
  context: Parameters<typeof serverlessHandler>[1]
) => {
  await prepareDatabase();
  return serverlessHandler(event, context);
};
