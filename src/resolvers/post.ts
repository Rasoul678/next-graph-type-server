import { isAuth } from "../middleware/isAuth";
import { MyContext } from "src/types";
import {
  Arg,
  Ctx,
  Field,
  FieldResolver,
  InputType,
  Int,
  Mutation,
  ObjectType,
  Query,
  Resolver,
  Root,
  UseMiddleware,
} from "type-graphql";
import { getConnection } from "typeorm";
import { Post, User } from "../entities";

@InputType()
class PostInput {
  @Field()
  title: string;

  @Field()
  text: string;
}

@ObjectType()
class PaginatedPosts {
  @Field(() => [Post])
  posts: Post[];

  @Field()
  hasMore: boolean;
}

@Resolver(Post)
export class PostResolver {
  //! It is just for graphql level(not in db) and every time we get a post object,
  //! We amend this field to that and reveal to client.
  //! We could add this field to Post entity (as as class field) but it is not a good practice.
  @FieldResolver(() => String)
  textSnippet(@Root() post: Post) {
    return post.text.slice(0, 50);
  }

  @FieldResolver(() => User)
  creator(@Root() post: Post, @Ctx() { userLoader }: MyContext) {
    return userLoader.load(post.creatorId);
  }

  //! Get all posts.
  @Query(() => PaginatedPosts)
  async posts(
    @Arg("limit", () => Int) limit: number,
    @Arg("cursor", () => String, { nullable: true }) cursor: string | null,
    @Ctx() { req }: MyContext
  ): Promise<PaginatedPosts> {
    const realLimit = Math.min(50, limit);
    const realLimitPlusOne = realLimit + 1;

    //! query parameters array
    const replacement: any[] = [realLimitPlusOne];

    //! add the values to replacement array by conditionally
    if (req.session.userId) {
      replacement.push(req.session.userId);
    }

    let cursorIdx = 3;
    if (cursor) {
      replacement.push(new Date(parseInt(cursor)));

      cursorIdx = replacement.length;
    }

    //! create a join query
    const posts = await getConnection().query(
      //! make attention on json_build_object method
      //! this will form this result as expected return type
      `
      SELECT p.*,
      ${
        req.session.userId
          ? '(SELECT value FROM upvote WHERE "userId" = $2 AND "postId" = p.id) "voteStatus"'
          : 'null AS "voteStatus"'
      }
      FROM post p
      ${cursor ? ` WHERE  p."createdAt" < $${cursorIdx}` : ""}
      ORDER BY p."createdAt" DESC
      LIMIT $1
  `,
      replacement
    );

    return {
      posts: posts.slice(0, realLimit), //! slice the post array to return actual limit
      hasMore: posts.length === realLimitPlusOne, //! set the boolean to indicate for there are more post or not
    };
  }

  //! Get post by id.
  @Query(() => Post, { nullable: true })
  post(@Arg("id", () => Int) id: number): Promise<Post | undefined> {
    return Post.findOne(id);
  }

  //! Create a post.
  @Mutation(() => Post)
  @UseMiddleware(isAuth)
  async createPost(
    @Arg("input", () => PostInput) input: PostInput,
    @Ctx() { req }: MyContext
  ): Promise<Post> {
    return Post.create({ ...input, creatorId: req.session.userId }).save();
  }

  //! Update a post.
  @Mutation(() => Post, { nullable: true })
  @UseMiddleware(isAuth)
  async updatePost(
    @Arg("id", () => Int) id: number,
    @Arg("title") title: string,
    @Arg("text") text: string,
    @Ctx() { req }: MyContext
  ): Promise<Post | null> {
    const result = await getConnection()
      .createQueryBuilder()
      .update(Post)
      .set({ text, title })
      .where('id = :id and "creatorId" = :creatorId', {
        id,
        creatorId: req.session.userId,
      })
      .returning("*")
      .execute();

    return result.raw[0];
  }

  //! Delete a post.
  @Mutation(() => Boolean)
  @UseMiddleware(isAuth)
  async deletePost(
    @Arg("id", () => Int) id: number,
    @Ctx() { req }: MyContext
  ): Promise<boolean> {
    try {
      await Post.delete({ id, creatorId: req.session.userId });

      return true;
    } catch (error) {
      return false;
    }
  }
}
