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
import { UpVote, Post } from "../entities";

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
      json_build_object(
        'id', u.id,
        'username', u.username,
        'email', u.email,
        'createdAt', u."createdAt",
        'updatedAt', u."updatedAt"
      ) creator,
      ${
        req.session.userId
          ? '(SELECT value FROM upvote WHERE "userId" = $2 AND "postId" = p.id) "voteStatus"'
          : 'null AS "voteStatus"'
      }
      FROM post p
      INNER JOIN public.user u ON u.id = p."creatorId"
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
    return Post.findOne(id, { relations: ["creator"] });
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
  @UseMiddleware(isAuth)
  async deletePost(
    @Arg("id", () => Int) id: number,
    @Ctx() { req }: MyContext
  ): Promise<boolean> {
    try {
      const post = await Post.findOne(id);

      //! Post not found.
      if (!post) {
        return false;
      }

      if (post.creatorId !== req.session.userId) {
        throw new Error("not authorized");
      }
      
      await UpVote.delete({ postId: id });
      await Post.delete(id);

      return true;
    } catch (error) {
      return false;
    }
  }
}
