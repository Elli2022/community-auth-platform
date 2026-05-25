import { mapUserToResponse } from "../../db/map-user";
import type makeUsersRepository from "../../db/users-repository";

type UsersRepository = ReturnType<typeof makeUsersRepository>;
type DataManipulation = { transformDate: (ts: number) => string };

export default function createGet({
  usersRepository,
  makeDataManipulation,
  logger,
}: {
  usersRepository: UsersRepository;
  makeDataManipulation: () => DataManipulation;
  logger: { info: (message: string) => void };
}) {
  const dataManipulation = makeDataManipulation();

  return Object.freeze({ get });

  async function get() {
    try {
      logger.info("[USE-CASE][GET] Reading users from database - START");
      const rows = await usersRepository.findAll();
      logger.info("[USE-CASE][GET] Reading users from database - DONE");
      return rows.map((row) =>
        mapUserToResponse(row, dataManipulation.transformDate)
      );
    } catch (e) {
      if (e instanceof Error) throw e;
      throw new Error(String(e));
    }
  }
}
