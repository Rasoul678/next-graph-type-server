import "reflect-metadata";
import http from "http";
import Redis from "ioredis";
import express from "express";
import session from "express-session";
import connectRedis from "connect-redis";
import cors from "cors";
import {
  ApolloServerPluginLandingPageGraphQLPlayground,
  ApolloServerPluginDrainHttpServer,
} from "apollo-server-core";
import { ApolloServer } from "apollo-server-express";
import { buildSchema } from "type-graphql";
import { MikroORM } from "@mikro-orm/core";
import mikroConfig from "./mikro-orm.config";
import { COOKIE_NAME, __prod__ } from "./constants";
import { PostResolver, UserResolver } from "./resolvers";
import { MyContext } from "./types";

const main = async () => {
  const orm = await MikroORM.init(mikroConfig);
  await orm.getMigrator().up();
  const RedisStore = connectRedis(session);
  const redisClient = new Redis();

  const app = express();

  app.use(cors({ origin: "http://localhost:3000", credentials: true }));

  app.use(
    session({
      name: COOKIE_NAME,
      store: new RedisStore({ client: redisClient, disableTouch: true }),
      saveUninitialized: false,
      secret: "rasoul",
      resave: false,
      cookie: {
        maxAge: 1000 * 60 * 60 * 24 * 365 * 10, //! 10 years
        httpOnly: true, //! Good for security (not accessible from javascript code at frontend).
        secure: __prod__, //! Cookie only works in https.
        sameSite: "lax", //! CSRF.
      },
    })
  );

  const httpServer = http.createServer(app);

  const apolloServer = new ApolloServer({
    schema: await buildSchema({
      resolvers: [PostResolver, UserResolver],
      validate: false,
    }),
    context: ({ req, res }): MyContext => ({ orm, req, res }),
    plugins: [
      ApolloServerPluginDrainHttpServer({ httpServer }),
      ApolloServerPluginLandingPageGraphQLPlayground(),
    ],
  });

  await apolloServer.start();
  apolloServer.applyMiddleware({ app, cors: false });

  await new Promise<void>((resolve) =>
    httpServer.listen({ port: 4000 }, resolve)
  );

  console.log(
    `🚀 Server ready at http://localhost:4000${apolloServer.graphqlPath}`
  );
};

main().catch((err) => {
  console.log(err);
});
