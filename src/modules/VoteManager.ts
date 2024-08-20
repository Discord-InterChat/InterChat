import db from '../utils/Db.js';
import Scheduler from './SchedulerService.js';
import { WebhookPayload } from '@top-gg/sdk';
import { stripIndents } from 'common-tags';
import { ClusterManager } from 'discord-hybrid-sharding';
import { WebhookClient, userMention, EmbedBuilder } from 'discord.js';
import { badgeEmojis, LINKS, VOTER_ROLE_ID } from '../utils/Constants.js';
import { getOrdinalSuffix, getUsername, modifyUserRole } from '../utils/Utils.js';
import EventEmitter from 'events';
import { getCachedData } from '#main/utils/cache/cacheUtils.js';

export type TopggEvents = {
  vote: WebhookPayload;
  voteExpired: string;
};

export class VoteManager extends EventEmitter {
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

  on<K extends keyof TopggEvents>(event: K, listener: (data: TopggEvents[K]) => void): this {
    return super.on(event, listener);
  }

  emit<K extends keyof TopggEvents>(event: K, data: TopggEvents[K]): boolean {
    return super.emit(event, data);
  }

  once<K extends keyof TopggEvents>(event: K, listener: (data: TopggEvents[K]) => void): this {
    return super.once(event, listener);
  }

  async getDbUser(id: string) {
    return (await getCachedData(
      `userData:${id}`,
      async () => await db.userData.findFirst({ where: { id } }),
    )).data;
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
      userMentionStr;

    await webhook.send({
      content: `${userMentionStr} (**${username}**)`,
      embeds: [
        new EmbedBuilder()
          .setDescription(
            stripIndents`
            ### ${badgeEmojis.Voter} Thank you for voting!
              
            You can vote again on [top.gg](${LINKS.VOTE}) in 12 hours!
            `,
          )
          .setFooter({ text: `This is your ${voteCount}${ordinalSuffix} time voting!` })
          .setColor('Green'),
      ],
    });
  }

  async addVoterRole(userId: string) {
    await modifyUserRole(this.cluster, 'add', { userId, roleId: VOTER_ROLE_ID });
  }
  async removeVoterRole(userId: string) {
    await modifyUserRole(this.cluster, 'remove', { userId, roleId: VOTER_ROLE_ID });
  }
}
