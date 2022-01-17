import {
  Arg,
  Ctx,
  Field,
  Mutation,
  ObjectType,
  Query,
  Resolver,
} from "type-graphql";
import { User } from "../entities";
import { MyContext } from "src/types";
import argon2 from "argon2";
import { COOKIE_NAME, FORGET_PASSWORD_PREFIX } from "../constants";
import { UsernamePasswordInput } from "./UsernamePasswordInput";
import { validateRegister } from "../utils/validateRegister";
import { sendEmail } from "../utils/senEmail";
import { v4 } from "uuid";

@ObjectType()
class FieldError {
  @Field()
  field: string;

  @Field()
  message: string;
}

@ObjectType()
class UserResponse {
  @Field(() => [FieldError], { nullable: true })
  errors?: FieldError[];

  @Field(() => User, { nullable: true })
  user?: User;
}

@Resolver(User)
export class UserResolver {
  @Mutation(() => UserResponse)
  async changePassword(
    @Arg("token") token: string,
    @Arg("newPassword") newPassword: string,
    @Ctx() { redis, req }: MyContext
  ): Promise<UserResponse> {
    //! In case if password length is not long enough
    if (newPassword.length <= 3) {
      return {
        errors: [
          {
            field: "newPassword",
            message: "Password length must be greater than 3",
          },
        ],
      };
    }

    const key = FORGET_PASSWORD_PREFIX + token;

    //! Extract user id from token
    const userId = await redis.get(key);

    if (!userId) {
      return {
        errors: [
          {
            field: "token",
            message: "token expired",
          },
        ],
      };
    }

    //! Get user from db
    const user = await User.findOne(userId);

    if (!user) {
      return {
        errors: [
          {
            field: "token",
            message: "user no longer exists",
          },
        ],
      };
    }

    //! Hash the new password
    const hashedPassword = await argon2.hash(newPassword);

    //! Save user with the new password in db
    await User.update(userId, { password: hashedPassword });

    //! Delete token from redis
    await redis.del(key);

    //! Login user after change password
    req.session.userId = user.id;

    return { user };
  }

  @Mutation(() => Boolean)
  async forgotPassword(
    @Arg("email") email: string,
    @Ctx() { redis }: MyContext
  ) {
    const user = await User.findOne({ where: { email } });

    if (!user) {
      return true;
    }

    const token = v4();

    await redis.set(
      FORGET_PASSWORD_PREFIX + token,
      user.id,
      "ex",
      1000 * 60 * 10
    ); //! 10 minutes

    await sendEmail(
      email,
      `
      <a href="http://localhost:3000/change-password/${token}">reset password</a>
    `
    );

    return true;
  }

  @Query(() => User, { nullable: true })
  me(@Ctx() { req }: MyContext) {
    //! You are not logged in
    if (!req.session.userId) {
      return null;
    }

    return User.findOne(req.session.userId);
  }

  //! Register a user.
  @Mutation(() => UserResponse)
  async register(
    @Arg("input", () => UsernamePasswordInput) input: UsernamePasswordInput,
    @Ctx() { req }: MyContext
  ): Promise<UserResponse> {
    const { password, username, email } = input;

    const errors = validateRegister(input);

    if (errors) {
      return { errors };
    }

    const hashedPassword = await argon2.hash(password);

    const user = User.create({
      username,
      password: hashedPassword,
      email,
    });
    try {
      await user.save();
    } catch (error) {
      //! Duplicate username error.
      //! || error.detail.includes("already exists")
      if (error.code === "23505") {
        return {
          errors: [
            {
              field: "username",
              message: "Username already taken!",
            },
          ],
        };
      }
    }

    //! Store user id session
    //! This will set a cookie on the user
    //! Keep them logged in
    req.session.userId = user.id;

    return { user };
  }

  //! Login a user.
  @Mutation(() => UserResponse)
  async login(
    @Arg("usernameOrEmail") usernameOrEmail: string,
    @Arg("password") password: string,
    @Ctx() { req }: MyContext
  ): Promise<UserResponse> {
    const persistedUser = await User.findOne({
      where: usernameOrEmail.includes("@")
        ? { email: usernameOrEmail }
        : { username: usernameOrEmail },
    });

    if (!persistedUser) {
      return {
        errors: [
          {
            field: "usernameOrEmail",
            message: "Credentials doesn't match!",
          },
          {
            field: "password",
            message: "Credentials doesn't match!",
          },
        ],
      };
    }

    const isValidUser = await argon2.verify(persistedUser.password, password);

    if (!isValidUser) {
      return {
        errors: [
          {
            field: "usernameOrEmail",
            message: "Credentials doesn't match!",
          },
          {
            field: "password",
            message: "Credentials doesn't match!",
          },
        ],
      };
    }

    req.session.userId = persistedUser.id;

    return { user: persistedUser };
  }

  @Mutation(() => Boolean)
  logout(@Ctx() { req, res }: MyContext) {
    return new Promise((resolve) => {
      res.clearCookie(COOKIE_NAME);
      req.session.destroy((error) => {
        if (error) {
          console.log(error);
          resolve(false);
          return;
        }

        resolve(true);
      });
    });
  }
}
