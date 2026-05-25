import { getSql } from "../../db/client";
import makeUsersRepository from "../../db/users-repository";
import { logger } from "../../libs/logger";

const usersRepository = makeUsersRepository({
  sql: getSql(),
  logger,
});

export { usersRepository };
