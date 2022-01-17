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
import { Post } from "../entities/Post";
import { getConnection } from "typeorm";

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
  textSnippet(@Root() root: Post) {
    return root.text.slice(0, 50);
  }

  //! Get all posts.
  @Query(() => PaginatedPosts)
  async posts(
    @Arg("limit", () => Int) limit: number,
    @Arg("cursor", () => String, { nullable: true }) cursor: string | null
  ): Promise<PaginatedPosts> {
    const realLimit = Math.min(50, limit);
    const realLimitPlusOne = realLimit + 1;

    //! query parameters array
    const replacement: any[] = [realLimitPlusOne];

    if (cursor) {
      replacement.push(new Date(parseInt(cursor)));
    }

    //! create a join query
    const posts = await getConnection().query(
      //! make attention on json_build_object method
      //! this will form this result as expected return type
      `
    SELECT p.*,
    json_build_object(
    'id', u.id,
    'username', u.username,
    'email', u.email,
    'createdAt', u."createdAt",
    'updatedAt', u."updatedAt"
    ) creator
    FROM post p
    INNER JOIN public.user u on u.id = p."creatorId"
    ${cursor ? ` WHERE  p."createdAt" < $2` : ""}
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
  async updatePost(
    @Arg("id", () => Int) id: number,
    @Arg("title", () => String, { nullable: true }) title: string
  ): Promise<Post | null> {
    const post = await Post.findOne(id);

    if (!post) {
      return null;
    }

    if (typeof title !== undefined) {
      await Post.update({ id }, { title });
    }

    return post;
  }

  //! Delete a post.
  @Mutation(() => Boolean)
  async deletePost(@Arg("id", () => Int) id: number): Promise<boolean> {
    try {
      await Post.delete(id);
      return true;
    } catch (error) {
      return false;
    }
  }
}
