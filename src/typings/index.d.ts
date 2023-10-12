import { ClusterClient } from 'discord-hybrid-sharding';
import { Collection, Snowflake } from 'discord.js';
import { Logger } from 'winston';
import CommandHandler from '../structures/CommandHandler';
import NSFWClient from '../structures/NSFWDetection.ts';
import NetworkManager from '../structures/NetworkManager.ts';
import { Scheduler } from '../structures/Scheduler.ts';

declare module 'discord.js' {
  export interface Client {
    readonly logger: Logger;
    readonly version: string;
    readonly development: boolean;
    readonly description: string;
    readonly commandCooldowns: Collection<string, number>;
    readonly reactionCooldowns: Collection<string, number>;
    readonly cluster: ClusterClient<Client>;

    fetchGuild(guildId: Snowflake): Promise<Guild | undefined>;
    getScheduler(): Scheduler;
    getCommandManager(): CommandHandler;
    getCommandManager(): CommandHandler;
    getNetworkManager(): NetworkManager;
    getBlacklistManager(): BlacklistManager;
    getNSFWDetector(): NSFWClient;
  }
}
