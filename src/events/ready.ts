import BaseEventListener from '#main/core/BaseEventListener.js';
import Scheduler from '#main/modules/SchedulerService.js';
import updateBlacklists from '#main/tasks/updateBlacklists.js';
import cacheClient from '#main/utils/cache/cacheClient.js';
import Logger from '#main/utils/Logger.js';
import { Client } from 'discord.js';

export default class Ready extends BaseEventListener<'ready'> {
  readonly name = 'ready';
  public async execute(client: Client<true>) {
    Logger.info(`Logged in as ${client.user.tag}!`);

    const shardId = client.guilds.cache.first()?.shardId;
    const blacklistScheduled = await cacheClient.get('blacklistScheduled') ?? shardId?.toString();

    if (shardId === 0 && blacklistScheduled === '0') {
      updateBlacklists(client);

      const scheduler = new Scheduler();
      scheduler.stopTask('deleteExpiredBlacklists');

      scheduler.addRecurringTask('deleteExpiredBlacklists', 30 * 1000, () =>
        updateBlacklists(client),
      );

      cacheClient.set('blacklistScheduled', `${shardId}`);
    }
  }
}
