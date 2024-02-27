import db from '../utils/Db.js';
import Scheduler from '../services/SchedulerService.js';
import { WebhookPayload } from '@top-gg/sdk';
import { stripIndents } from 'common-tags';
import { ClusterManager } from 'discord-hybrid-sharding';
import { WebhookClient, userMention, EmbedBuilder } from 'discord.js';
import { badgeEmojis, LINKS, SUPPORT_SERVER_ID, VOTER_ROLE_ID } from '../utils/Constants.js';
import { getOrdinalSuffix, getUsername, modifyUserRole } from '../utils/Utils.js';
import { EventEmitter } from 'events';

export type TopggEvents = {
  vote: WebhookPayload;
  voteExpired: string;
};

export class VoteManager extends EventEmitter {
  private scheduler = new Scheduler();
  private cluster: ClusterManager;

  constructor(cluster: ClusterManager) {
    super();
    this.cluster = cluster;
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

  async incrementAndScheduleVote(userId: string, username?: string) {
    await this.incrementUserVote(userId, username);
    await this.addVoterRole(userId);

    const taskName = `voteExpired-${userId}`;
    if (this.scheduler.taskNames.includes(taskName)) this.scheduler.stopTask(taskName);

    this.scheduler.addTask(`voteExpired-${userId}`, 12 * 60 * 60 * 1000, async () => {
      this.emit('voteExpired', userId);
      await this.removeVoterRole(userId);
    });
  }

  async getUserVoteCount(userId: string) {
    const user = await db.userData.findUnique({ where: { userId } });
    return user?.voteCount ?? 0;
  }

  async incrementUserVote(userId: string, username?: string) {
    return await db.userData.upsert({
      where: { userId },
      create: {
        userId,
        username,
        lastVoted: new Date().getTime(),
        voteCount: 1,
      },
      update: {
        voteCount: { increment: 1 },
      },
    });
  }

  async announceVote(vote: WebhookPayload) {
    const voteCount = (await this.getUserVoteCount(vote.user)) + 1;
    const webhook = new WebhookClient({
      url: String(process.env.VOTE_WEBHOOK_URL),
    });
    const ordinalSuffix = getOrdinalSuffix(voteCount);
    const userMentionStr = userMention(vote.user);
    const username = (await getUsername(this.cluster, vote.user)) ?? userMentionStr;

    await webhook.send({
      content: userMentionStr,
      embeds: [
        new EmbedBuilder()
          .setDescription(
            stripIndents`
            ### ${badgeEmojis.Voter} Thank you for voting!
            User **${username}** just voted for InterChat! Thank you for your support!
              
            You can vote again on [top.gg](${LINKS.VOTE}) in 12 hours!
            `,
          )
          .setFooter({ text: `This is your ${voteCount}${ordinalSuffix} time voting!` })
          .setColor('Green'),
      ],
    });
  }

  async addVoterRole(userId: string) {
    await modifyUserRole(this.cluster, 'add', userId, SUPPORT_SERVER_ID, VOTER_ROLE_ID);
  }
  async removeVoterRole(userId: string) {
    await modifyUserRole(this.cluster, 'remove', userId, SUPPORT_SERVER_ID, VOTER_ROLE_ID);
  }
}
