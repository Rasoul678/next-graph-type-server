import { Redis } from "ioredis";
import { MikroORM, Connection, IDatabaseDriver } from "@mikro-orm/core";
import { Request, Response } from "express";
import { Session, SessionData } from "express-session";

export type MyContext = {
  orm: MikroORM<IDatabaseDriver<Connection>>;
  req: Request & { session?: Session & Partial<SessionData> & { userId?: number } };
  res: Response;
  redis: Redis
};
