import type { WebhookPayload } from '#main/types/topgg.d.ts';
import { getCachedData } from '#main/utils/cache/cacheUtils.js';
import { stripIndents } from 'common-tags';
import { ClusterManager } from 'discord-hybrid-sharding';
import { EmbedBuilder, time, userMention, WebhookClient } from 'discord.js';
import EventEmitter from 'events';
import Constants, { emojis, RedisKeys } from '#main/config/Constants.js';
import db from '#main/utils/Db.js';
import { getOrdinalSuffix, getUsername, modifyUserRole } from '#main/utils/Utils.js';
import Scheduler from './SchedulerService.js';
import parse from 'parse-duration';

export type TopggEvents = {
  vote: WebhookPayload[];
  voteExpired: string[];
};

export class VoteManager extends EventEmitter<TopggEvents> {
  private scheduler: Scheduler;
  private cluster: ClusterManager;

  constructor(cluster: ClusterManager, scheduler = new Scheduler()) {
    super();
    this.cluster = cluster;
    this.scheduler = scheduler;
    this.scheduler.addRecurringTask('removeVoterRole', 60 * 60 * 1_000, async () => {
      const expiredVotes = await db.userData.findMany({ where: { lastVoted: { lt: new Date() } } });
      for (const vote of expiredVotes) {
        this.emit('voteExpired', vote.id);
        await this.removeVoterRole(vote.id);
      }
    });
  }

  async getDbUser(id: string) {
    return (
      await getCachedData(
        `${RedisKeys.userData}:${id}`,
        async () => await db.userData.findFirst({ where: { id } }),
      )
    ).data;
  }

  async getUserVoteCount(id: string) {
    const user = await this.getDbUser(id);
    return user?.voteCount ?? 0;
  }

  async incrementUserVote(userId: string, username?: string) {
    const lastVoted = new Date();
    return await db.userData.upsert({
      where: { id: userId },
      create: { id: userId, username, lastVoted, voteCount: 1 },
      update: { lastVoted, voteCount: { increment: 1 } },
    });
  }

  async announceVote(vote: WebhookPayload) {
    const voteCount = (await this.getUserVoteCount(vote.user)) + 1;
    const webhook = new WebhookClient({
      url: String(process.env.VOTE_WEBHOOK_URL),
    });
    const ordinalSuffix = getOrdinalSuffix(voteCount);
    const userMentionStr = userMention(vote.user);
    const username =
      (await getUsername(this.cluster, vote.user)) ??
      (await this.getDbUser(vote.user))?.username ??
      'Unknown User';

    const isTestVote = vote.type === 'test';
    const timeUntilNextVote = time(new Date(Date.now() + (parse('12h') ?? 0)), 'R');

    await webhook.send({
      content: `${userMentionStr} (**${username}**)`,
      embeds: [
        new EmbedBuilder()
          .setDescription(
            stripIndents`
            ### ${emojis.topggSparkles} Thank you for voting!
              
            You can vote again on [top.gg](${Constants.Links.Vote}) ${timeUntilNextVote}!

            -# ${isTestVote ? '⚠️ This is a test vote.' : `${emojis.tada} This is your **${voteCount}${ordinalSuffix}** time voting!`}
            `,
          )
          .setColor('#FB3265'),
      ],
    });
  }

  async addVoterRole(userId: string) {
    await modifyUserRole(this.cluster, 'add', { userId, roleId: Constants.VoterRoleId });
  }
  async removeVoterRole(userId: string) {
    await modifyUserRole(this.cluster, 'remove', { userId, roleId: Constants.VoterRoleId });
  }
}
