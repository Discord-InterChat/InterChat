import type { ClusterManager } from 'discord-hybrid-sharding';
import { startApi } from '#main/api/index.js';
import deleteExpiredInvites from '#main/scheduled/tasks/deleteExpiredInvites.js';
import pauseIdleConnections from '#main/scheduled/tasks/pauseIdleConnections.js';
import storeMsgTimestamps from '#main/scheduled/tasks/storeMsgTimestamps.js';
import syncBotlistStats from '#main/scheduled/tasks/syncBotlistStats.js';
import Scheduler from '#main/services/SchedulerService.js';
import Constants from '#main/utils/Constants.js';
import Logger from '#main/utils/Logger.js';

export default function startTasks(clusterManager: ClusterManager) {
  startApi();

  pauseIdleConnections().catch(Logger.error);
  deleteExpiredInvites().catch(Logger.error);

  const scheduler = new Scheduler();

  // store network message timestamps to Connection every minute
  scheduler.addRecurringTask('storeMsgTimestamps', 10 * 60 * 1000, storeMsgTimestamps);
  scheduler.addRecurringTask('cleanupTasks', 60 * 60 * 1000, () => {
    deleteExpiredInvites().catch(Logger.error);
    pauseIdleConnections().catch(Logger.error);
  });

  // production only tasks
  if (!Constants.isDevBuild) {
    scheduler.addRecurringTask('syncBotlistStats', 10 * 60 * 10_000, async () => {
      const servers = await clusterManager.fetchClientValues('guilds.cache.size');
      const serverCount = servers.reduce((p: number, n: number) => p + n, 0);
      syncBotlistStats({
        serverCount,
        shardCount: clusterManager.totalShards,
      });
    });
  }
}
