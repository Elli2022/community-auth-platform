import { getSql } from "../../db/client";
import makeMessagesRepository from "../../db/messages-repository";

const messagesRepository = makeMessagesRepository({ sql: getSql() });

export { messagesRepository };
