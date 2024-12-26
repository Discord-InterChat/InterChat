import BaseEventListener from '#main/core/BaseEventListener.js';
import updateBlacklists from '#main/scheduled/tasks/updateBlacklists.js';
import Scheduler from '#main/services/SchedulerService.js';
import Logger from '#utils/Logger.js';
import { ActivityType, Client } from 'discord.js';

export default class Ready extends BaseEventListener<'ready'> {
  readonly name = 'ready';
  public execute(client: Client<true>) {
    Logger.info(`Logged in as ${client.user.tag}!`);

    client.application.emojis.fetch();

    if (client.cluster.id === 0) {
      Logger.debug(`Cluster ${client.cluster.id} is updating blacklists...`);
      updateBlacklists(client).then(() =>
        Logger.debug(`Cluster ${client.cluster.id} has finished updating blacklists!`),
      );

      Logger.debug(`Cluster ${client.cluster.id} is setting up recurring tasks...`);
      const scheduler = new Scheduler();
      scheduler.stopTask('deleteExpiredBlacklists');
      scheduler.addRecurringTask('deleteExpiredBlacklists', 30 * 1000, () =>
        updateBlacklists(client),
      );
      Logger.debug(`Cluster ${client.cluster.id} has set up recurring tasks!`);
    }

    client.user.setActivity({
      name: `/setup | Cluster ${client.cluster.id}`,
      type: ActivityType.Watching,
    });
  }
}
