import BaseEventListener from '#main/core/BaseEventListener.js';
import Scheduler from '#main/services/SchedulerService.js';
import updateBlacklists from '#main/scheduled/tasks/updateBlacklists.js';
import Logger from '#utils/Logger.js';
import getRedis from '#utils/Redis.js';
import { ActivityType, Client } from 'discord.js';

export default class Ready extends BaseEventListener<'ready'> {
  readonly name = 'ready';
  public execute(client: Client<true>) {
    Logger.info(`Logged in as ${client.user.tag}!`);

    const redisClient = getRedis();
    const shardId = client.guilds.cache.first()?.shardId;

    if (shardId === 0) {
      updateBlacklists(client);

      const scheduler = new Scheduler();
      scheduler.stopTask('deleteExpiredBlacklists');

      scheduler.addRecurringTask('deleteExpiredBlacklists', 30 * 1000, () =>
        updateBlacklists(client),
      );

      redisClient.set('blacklistScheduled', `${shardId}`);
    }

    client.user.setActivity({
      name: `🎉 InterChat v4 | Shard ${shardId}`,
      type: ActivityType.Watching,
    });
  }
}
