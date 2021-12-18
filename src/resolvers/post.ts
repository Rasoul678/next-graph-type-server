import { Arg, Ctx, Int, Mutation, Query, Resolver } from "type-graphql";
import { Post } from "../entities/Post";
import { MyContext } from "src/types";

@Resolver()
export class PostResolver {
  //! Get all posts.
  @Query(() => [Post])
  posts(@Ctx() { orm }: MyContext): Promise<Post[]> {
    return orm.em.find(Post, {});
  }

  //! Get post by id.
  @Query(() => Post, { nullable: true })
  post(
    @Arg("id", () => Int) id: number,
    @Ctx() { orm }: MyContext
  ): Promise<Post | null> {
    return orm.em.findOne(Post, { id });
  }

  //! Create a post.
  @Mutation(() => Post)
  async createPost(
    @Arg("title", () => String) title: string,
    @Ctx() { orm }: MyContext
  ): Promise<Post> {
    const post = orm.em.create(Post, { title });
    await orm.em.persistAndFlush(post);
    return post;
  }

  //! Update a post.
  @Mutation(() => Post, { nullable: true })
  async updatePost(
    @Arg("id", () => Int) id: number,
    @Arg("title", () => String, { nullable: true }) title: string,
    @Ctx() { orm }: MyContext
  ): Promise<Post | null> {
    const post = await orm.em.findOne(Post, { id });

    if (!post) {
      return null;
    }

    if (typeof title !== undefined) {
      post.title = title;
      await orm.em.persistAndFlush(post);
    }

    return post;
  }

  //! Delete a post.
  @Mutation(() => Boolean)
  async deletePost(
    @Arg("id", () => Int) id: number,
    @Ctx() { orm }: MyContext
  ): Promise<boolean> {
    try {
      await orm.em.nativeDelete(Post, { id });
      return true;
    } catch (error) {
      return false;
    }
  }
}
