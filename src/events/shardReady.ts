import BaseEventListener from '#main/core/BaseEventListener.js';
import Logger from '#main/utils/Logger.js';

export default class ShardReady extends BaseEventListener<'shardReady'> {
  readonly name = 'shardReady';

  execute(shardId: number, unavailableGuilds: Set<string>): void {
    if (unavailableGuilds) {
      Logger.warn(`Shard ${shardId} is ready but ${unavailableGuilds.size} guilds are unavailable.`);
    }
    else {
      Logger.info(`Shard ${shardId} is ready!`);
    }
  }
}
