import { Redis } from "ioredis";
import { Request, Response } from "express";
import { Session, SessionData } from "express-session";
import { createUserLoader } from "../utils/createUserLoader";
import { createUpVoteLoader } from "src/utils/createUpVoteLoader";

export type MyContext = {
  req: Request & {
    session?: Session & Partial<SessionData> & { userId?: number };
  };
  res: Response;
  redis: Redis;
  userLoader: ReturnType<typeof createUserLoader>;
  upVoteLoader: ReturnType<typeof createUpVoteLoader>;
};
