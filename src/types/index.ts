import { MikroORM, Connection, IDatabaseDriver } from "@mikro-orm/core";

export type MyContext = {
  orm: MikroORM<IDatabaseDriver<Connection>>;
};
