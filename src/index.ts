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
import { COOKIE_NAME, __prod__ } from "./constants";
import { PostResolver, UpVoteResolver, UserResolver } from "./resolvers";
import { MyContext } from "./types";
import { createConnection } from "typeorm";
import { Post, UpVote, User } from "./entities";
import path from "path";
import { createUserLoader } from "./utils/createUserLoader";
import { createUpVoteLoader } from "./utils/createUpVoteLoader";

const main = async () => {
  //! Initialize type-orm and connect to db.
  const connection = await createConnection({
    type: "postgres",
    database: "next-graphql",
    username: "postgres",
    password: "rasoul678",
    logging: true,
    synchronize: true,
    entities: [User, Post, UpVote],
    migrations: [path.join(__dirname + "/migrations/*")],
  });

  await connection.runMigrations();

  //! Setup Redis session store.
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

  //! Add graphql server.
  const apolloServer = new ApolloServer({
    schema: await buildSchema({
      resolvers: [PostResolver, UserResolver, UpVoteResolver],
      validate: false,
    }),
    context: ({ req, res }): MyContext => ({
      req,
      res,
      redis: redisClient,
      userLoader: createUserLoader(),
      upVoteLoader: createUpVoteLoader()
    }),
    plugins: [
      ApolloServerPluginDrainHttpServer({ httpServer }),
      ApolloServerPluginLandingPageGraphQLPlayground(),
    ],
  });

  await apolloServer.start();

  //! Creates graphql endpoint on express.
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
