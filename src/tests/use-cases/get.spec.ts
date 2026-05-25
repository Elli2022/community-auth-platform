import { expect } from "chai";
import createGet from "../../app/component/use-cases/get";
import makeDataManipulation from "../../app/component/entities/data-manipulation";
import { logger } from "../../app/libs/logger";
import config from "../../config";
import {
  setupTestDatabase,
  teardownTestDatabase,
  usersRepository,
} from "../helpers/db";

const get = () =>
  createGet({
    usersRepository,
    makeDataManipulation,
    logger,
  }).get();

describe("get", () => {
  before(async () => {
    await setupTestDatabase();
    await usersRepository.create({
      username: config.TEST_DATA.user1.username,
      password: "test-hash",
      created: new Date().toISOString(),
      modified: new Date().toISOString(),
    });
    await usersRepository.create({
      username: config.TEST_DATA.user2.username,
      password: "test-hash",
      created: new Date().toISOString(),
      modified: new Date().toISOString(),
    });
  });

  after(async () => teardownTestDatabase());

  it("should return a list of users", async () => {
    const results = await get();
    expect(results).to.have.length(2);
  });
});
