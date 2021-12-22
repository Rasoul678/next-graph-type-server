import {
  Arg,
  Ctx,
  Field,
  InputType,
  Mutation,
  ObjectType,
  Resolver,
} from "type-graphql";
import { User } from "../entities";
import { MyContext } from "src/types";
import argon2 from "argon2";

@InputType()
class UsernamePasswordInput {
  @Field()
  username: string;

  @Field()
  password: string;
}

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

@Resolver()
export class UserResolver {
  //! Register a user.
  @Mutation(() => UserResponse)
  async register(
    @Arg("input", () => UsernamePasswordInput) input: UsernamePasswordInput,
    @Ctx() { orm }: MyContext
  ): Promise<UserResponse> {
    const { password, username } = input;

    if (username.length <= 2) {
      return {
        errors: [
          {
            field: "username",
            message: "Username length must be greater than 2",
          },
        ],
      };
    }

    if (password.length <= 3) {
      return {
        errors: [
          {
            field: "password",
            message: "Password length must be greater than 3",
          },
        ],
      };
    }

    const hashedPassword = await argon2.hash(password);

    const user = orm.em.create(User, { username, password: hashedPassword });
    try {
      await orm.em.persistAndFlush(user);
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

    return { user };
  }

  //! Login a user.
  @Mutation(() => UserResponse)
  async login(
    @Arg("input", () => UsernamePasswordInput) input: UsernamePasswordInput,
    @Ctx() { orm }: MyContext
  ): Promise<UserResponse> {
    const { password, username } = input;
    const persistedUser = await orm.em.findOne(User, { username });

    if (!persistedUser) {
      return {
        errors: [
          {
            field: "input",
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
            field: "input",
            message: "Credentials doesn't match!",
          },
        ],
      };
    }

    return { user: persistedUser };
  }
}
