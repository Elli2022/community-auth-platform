import { mapUserToResponse } from "../../db/map-user";
import type makeUsersRepository from "../../db/users-repository";

type UsersRepository = ReturnType<typeof makeUsersRepository>;

export default function createPost({
  makeInputObj,
  usersRepository,
  makeDataManipulation,
  logger,
}: {
  makeInputObj: (args: { params: Record<string, unknown> }) => {
    username: () => string;
    password: () => string;
    email: () => string;
    name: () => string;
    surname: () => string;
    created: () => unknown;
    modified: () => unknown;
  };
  usersRepository: UsersRepository;
  makeDataManipulation: () => { transformDate: (ts: number) => string };
  logger: { info: (message: string) => void };
}) {
  const dataManipulation = makeDataManipulation();

  return Object.freeze({ post });

  async function post({
    params,
    errorMsgs,
  }: {
    params: Record<string, unknown>;
    errorMsgs: Record<string, string>;
  }) {
    try {
      logger.info("[USE-CASE][POST] Inserting user to database - START");

      if (!params || Object.keys(params).length === 0) {
        throw new Error(errorMsgs.NO_DATA);
      }

      const userFactory = makeInputObj({ params });

      const createdMs = Number(userFactory.created());
      const modifiedMs = Number(userFactory.modified());

      const userInput = {
        username: userFactory.username(),
        password: userFactory.password(),
        created: new Date(createdMs).toISOString(),
        modified: new Date(modifiedMs).toISOString(),
      } as {
        username: string;
        password: string;
        created: string;
        modified: string;
        email?: string;
        name?: string;
        surname?: string;
      };

      if (params.email !== undefined) userInput.email = userFactory.email();
      if (params.name !== undefined) userInput.name = userFactory.name();
      if (params.surname !== undefined) userInput.surname = userFactory.surname();

      const existing = await usersRepository.findByUsername(userInput.username);
      if (existing) {
        throw new Error(errorMsgs.EXISTING_USER);
      }

      const row = await usersRepository.create(userInput);
      logger.info("[USE-CASE][POST] Inserting user to database - DONE");
      return mapUserToResponse(row, dataManipulation.transformDate);
    } catch (e) {
      logger.info("[USE-CASE][POST] Inserting user to database - FAILED");
      throw e;
    }
  }
}
