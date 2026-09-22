import type { Database } from "./data/database.js";
import type { Actor } from "./domain/authz.js";
import type { Logger } from "./logger.js";

export type AppContext = {
  actor: Actor;
  db: Database;
  now: Date;
  requestId: string;
  logger: Logger;
};
