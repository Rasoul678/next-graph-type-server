import { UpVote } from "../entities";
import { Arg, Ctx, Int, Mutation, Resolver, UseMiddleware } from "type-graphql";
import { MyContext } from "src/types";
import { isAuth } from "../middleware/isAuth";
import { getConnection } from "typeorm";

@Resolver(UpVote)
export class UpVoteResolver {
  @Mutation(() => Boolean)
  @UseMiddleware(isAuth)
  async vote(
    @Arg("postId", () => Int) postId: number,
    @Arg("vote", () => Int) vote: number,
    @Ctx() { req }: MyContext
  ) {
    const isUpvote = vote !== -1;
    const realValue = isUpvote ? 1 : -1;
    const { userId } = req.session;

    await getConnection().query(
      `
      START TRANSACTION;
  
      INSERT INTO upvote ("userId", "postId", value)
  
      VALUES (${userId}, ${postId}, ${realValue});
  
      UPDATE post
      SET votes = votes + ${realValue}
      where id = ${postId};
  
      COMMIT;

      `
    );

    return true;
  }
}
