import { getSql } from "../../db/client";
import makeNotificationsRepository from "../../db/notifications-repository";

const notificationsRepository = makeNotificationsRepository({ sql: getSql() });

export { notificationsRepository };
