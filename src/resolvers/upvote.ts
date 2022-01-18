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

    const upvote = await UpVote.findOne({ where: { postId, userId } });

    //! The user has voted on the post before
    //! and they are changing their vote
    if (upvote && upvote.value !== realValue) {
      await getConnection().transaction(async (tm) => {
        await tm.query(
          ` update upvote
            set value = $1
            where "postId" = $2 and "userId" = $3`,
          [realValue, postId, userId]
        );

        await tm.query(
          ` update post
            set votes = votes + $1
            where id = $2`,
          [2 * realValue, postId]
        );
      });
    } else if (!upvote) {
      //! The user has never voted before
      await getConnection().transaction(async (tm) => {
        await tm.query(
          ` insert into upvote ("userId", "postId", value)
            values ($1, $2, $3)`,
          [userId, postId, realValue]
        );

        await tm.query(
          ` update post
            set votes = votes + $1
            where id = $2`,
          [realValue, postId]
        );
      });
    }

    return true;
  }
}
