import BaseEventListener from '#main/core/BaseEventListener.js';
import Scheduler from '#main/services/SchedulerService.js';
import updateBlacklists from '#main/scheduled/tasks/updateBlacklists.js';
import Logger from '#utils/Logger.js';
import getRedis from '#utils/Redis.js';
import { Client } from 'discord.js';

export default class Ready extends BaseEventListener<'ready'> {
  readonly name = 'ready';
  public async execute(client: Client<true>) {
    Logger.info(`Logged in as ${client.user.tag}!`);

    const redisClient = getRedis();
    const shardId = client.guilds.cache.first()?.shardId;
    const blacklistScheduled = (await redisClient.get('blacklistScheduled')) ?? shardId?.toString();

    if (shardId === 0 && blacklistScheduled === '0') {
      updateBlacklists(client);

      const scheduler = new Scheduler();
      scheduler.stopTask('deleteExpiredBlacklists');

      scheduler.addRecurringTask('deleteExpiredBlacklists', 30 * 1000, () =>
        updateBlacklists(client),
      );

      redisClient.set('blacklistScheduled', `${shardId}`);
    }
  }
}
