import "dotenv/config";
import config from "../config";
import { ensureSchema } from "./db/migrate";
import { server } from "./initializers/express";
import { logger } from "./libs/logger";

async function bootstrap() {
  try {
    logger.info(`[${config.APP_NAME}] Bootstrapping microservice`);
    await ensureSchema();
    logger.info(`[${config.APP_NAME}] Database schema ready`);
    server({ hostname: config.NODE_HOSTNAME, port: config.NODE_PORT });
  } catch (error) {
    logger.error(`[${config.APP_NAME}] Caught exception: ${error}`);
    process.exit(1);
  }
}

bootstrap();
