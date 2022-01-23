import DataLoader from "dataloader";
import { UpVote } from "../entities";

export const createUpVoteLoader = () =>
  new DataLoader<{ postId: number; userId: number }, UpVote | null>(
    async (keys) => {
      const upvotes = await UpVote.findByIds(keys as any);

      const upvoteIdsToUpvote: Record<string, UpVote> = {};

      upvotes.forEach((upvote) => {
        upvoteIdsToUpvote[`${upvote.postId}|${upvote.userId}`] = upvote;
      });

      return keys.map(
        (key) => upvoteIdsToUpvote[`${key.postId}|${key.userId}`]
      );
    }
  );
