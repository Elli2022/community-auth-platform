import { config as dotenvConfig } from "dotenv";
dotenvConfig();

import { expect } from "chai";
import config from "../../config";
import { logger } from "../../app/libs/logger";
import { makeInputObj } from "../../app/component/entities";
import createPost from "../../app/component/use-cases/post";
import makeDataManipulation from "../../app/component/entities/data-manipulation";
import {
  setupTestDatabase,
  teardownTestDatabase,
  usersRepository,
} from "../helpers/db";

const post = ({ params }: { params: Record<string, unknown> }) =>
  createPost({
    makeInputObj,
    usersRepository,
    makeDataManipulation,
    logger,
  }).post({ params, errorMsgs: config.ERROR_MSG.post });

describe("Post", () => {
  before(async () => setupTestDatabase());
  after(async () => teardownTestDatabase());

  it("should insert a user", async () => {
    const params = {
      username: config.TEST_DATA.user1.username,
      password: config.TEST_DATA.user1.password,
    };
    const results = await post({ params });
    const users = await usersRepository.findAll();
    expect(results).to.have.property("username").equal(params.username);
    expect(users.length).to.equal(1);
    expect(users[0]).to.have.property("username").equal(params.username);
  });

  it("should not insert an empty user", async () => {
    const params = {
      username: undefined,
      password: undefined,
    };
    try {
      await post({ params });
      expect.fail("should have thrown");
    } catch (err) {
      expect((err as Error).message).to.equal(
        config.ERROR_MSG.post.MISSING_PARAMETER + "username"
      );
    }
  });

  it("should not insert an existing user", async () => {
    const params = {
      username: config.TEST_DATA.user1.username,
      password: config.TEST_DATA.user1.password,
    };
    try {
      await post({ params });
      expect.fail("should have thrown");
    } catch (err) {
      expect((err as Error).message).to.equal(
        config.ERROR_MSG.post.EXISTING_USER
      );
    }
  });

  it("should insert another user", async () => {
    const params = {
      username: config.TEST_DATA.user2.username,
      password: config.TEST_DATA.user2.password,
    };
    await post({ params });
    const users = await usersRepository.findAll();
    expect(users.length).to.equal(2);
  });

  it("should not insert a user without a valid email", async () => {
    const params = {
      username: "user4",
      password: config.TEST_DATA.user1.password,
      email: "invalidEmail",
      name: "Test",
      surname: "User",
    };
    try {
      await post({ params });
      expect.fail("should have thrown");
    } catch (err) {
      expect((err as Error).message).to.include(
        config.ERROR_MSG.post.INVALID_EMAIL
      );
    }
  });

  it("should not insert a user without name or surname", async () => {
    const params = {
      username: "user5",
      password: config.TEST_DATA.user1.password,
      email: "test@example.com",
      name: "",
      surname: "",
    };
    try {
      await post({ params });
      expect.fail("should have thrown");
    } catch (err) {
      expect((err as Error).message).to.include(
        config.ERROR_MSG.post.MISSING_PARAMETER
      );
    }
  });

  it("should insert a user with valid email, name, and surname", async () => {
    const params = {
      username: config.TEST_DATA.user3.username,
      password: config.TEST_DATA.user3.password,
      email: "test@example.com",
      name: "Test",
      surname: "User",
    };
    const results = await post({ params });
    const users = await usersRepository.findAll();
    expect(results).to.have.property("email").equal(params.email);
    expect(results).to.have.property("name").equal(params.name);
    expect(results).to.have.property("surname").equal(params.surname);
    expect(users.length).to.equal(3);
    expect(users[2]).to.have.property("email").equal(params.email);
    expect(users[2]).to.have.property("name").equal(params.name);
    expect(users[2]).to.have.property("surname").equal(params.surname);
  });
});
