import Constants, { emojis } from '#main/config/Constants.js';
import UserDbManager from '#main/managers/UserDbManager.js';
import Scheduler from '#main/modules/SchedulerService.js';
import Logger from '#utils/Logger.js';
import type { WebhookPayload } from '#types/topgg.d.ts';
import db from '#utils/Db.js';
import { getOrdinalSuffix } from '#utils/Utils.js';
import { stripIndents } from 'common-tags';
import { APIUser, EmbedBuilder, REST, Routes, time, userMention, WebhookClient } from 'discord.js';
import type { NextFunction, Request, Response } from 'express';
import ms from 'ms';

export class VoteManager {
  private scheduler: Scheduler;
  private readonly userDbManager = new UserDbManager();
  private readonly rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN as string);

  constructor(scheduler = new Scheduler()) {
    this.scheduler = scheduler;
    this.scheduler.addRecurringTask('removeVoterRole', 60 * 60 * 1_000, async () => {
      const expiredVotes = await db.userData.findMany({ where: { lastVoted: { lt: new Date() } } });
      for (const vote of expiredVotes) {
        await this.removeVoterRole(vote.id);
      }
    });
  }

  async middleware(req: Request, res: Response, next: NextFunction) {
    const dblHeader = req.header('Authorization');
    if (dblHeader !== process.env.TOPGG_WEBHOOK_SECRET) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const payload = req.body;

    if (!this.isValidVotePayload(payload)) {
      Logger.error('Invalid payload received from top.gg, possible untrusted request: %O', payload);
      res.status(400).json({ message: 'Invalid payload' });
      return;
    }

    res.status(204).send();

    if (payload.type === 'upvote') {
      await this.incrementUserVote(payload.user);
      await this.addVoterRole(payload.user);
    }

    await this.announceVote(payload);

    next();
  }

  async getUserVoteCount(id: string) {
    const user = await this.userDbManager.getUser(id);
    return user?.voteCount ?? 0;
  }

  async incrementUserVote(userId: string, username?: string) {
    const lastVoted = new Date();
    const user = await this.userDbManager.getUser(userId);
    if (!user) {
      return await this.userDbManager.createUser({ id: userId, username, lastVoted, voteCount: 1 });
    }
    return await this.userDbManager.updateUser(userId, { lastVoted, voteCount: { increment: 1 } });
  }

  async getAPIUser(userId: string) {
    const user = await this.rest.get(Routes.user(userId)).catch(() => null);
    return user as APIUser | null;
  }

  async getUsername(userId: string) {
    const user = (await this.getAPIUser(userId)) ?? (await this.userDbManager.getUser(userId));
    return user?.username ?? 'Unknown User';
  }

  async announceVote(vote: WebhookPayload) {
    const voteCount = (await this.getUserVoteCount(vote.user)) + 1;
    const webhook = new WebhookClient({
      url: String(process.env.VOTE_WEBHOOK_URL),
    });
    const ordinalSuffix = getOrdinalSuffix(voteCount);
    const userMentionStr = userMention(vote.user);
    const username = await this.getUsername(vote.user);

    const isTestVote = vote.type === 'test';
    const timeUntilNextVote = time(new Date(Date.now() + (ms('12h') ?? 0)), 'R');

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

  async modifyUserRole(
    type: 'add' | 'remove',
    { userId, roleId }: { userId: string; roleId: string },
  ) {
    const method = type === 'add' ? 'put' : 'delete';
    return await this.rest[method](
      Routes.guildMemberRole(Constants.SupportServerId, userId, roleId),
    );
  }

  async addVoterRole(userId: string) {
    await this.modifyUserRole('add', { userId, roleId: Constants.VoterRoleId });
  }
  async removeVoterRole(userId: string) {
    await this.modifyUserRole('remove', { userId, roleId: Constants.VoterRoleId });
  }

  private isValidVotePayload(payload: WebhookPayload) {
    const payloadTypes = ['upvote', 'test'];
    const isValidData =
      typeof payload.user === 'string' &&
      typeof payload.bot === 'string' &&
      payloadTypes.includes(payload.type);

    const isValidWeekendType =
      typeof payload.isWeekend === 'boolean' || typeof payload.isWeekend === 'undefined';

    return isValidData && isValidWeekendType;
  }
}
