import { ClusterClient } from 'discord-hybrid-sharding';
import { Collection, Snowflake } from 'discord.js';
import { Logger } from 'winston';
import { Scheduler } from '../structures/Scheduler.ts';
import NSFWClient from '../structures/NSFWDetection.ts';
import NetworkManager from '../structures/NetworkManager.ts';
import BlacklistManager from '../structures/BlacklistManager.ts';
import CommandManager from '../structures/CommandManager.ts';

type RemoveMethods<T> = {
  [K in keyof T]: T[K] extends (...args: any[]) => any ? never : RemoveMethods<T[K]>;
};

declare module 'discord.js' {
  export interface Client {
    readonly logger: Logger;
    readonly version: string;
    readonly development: boolean;
    readonly description: string;
    readonly commandCooldowns: Collection<string, number>;
    readonly reactionCooldowns: Collection<string, number>;
    readonly cluster: ClusterClient<Client>;

    resolveEval: <T>(value: T[]) => T | undefined

    fetchGuild(guildId: Snowflake): Promise<RemoveMethods<Guild> | undefined>;
    getScheduler(): Scheduler;
    getCommandManager(): CommandManager;
    getCommandManager(): CommandManager;
    getNetworkManager(): NetworkManager;
    getBlacklistManager(): BlacklistManager;
    getNSFWDetector(): NSFWClient;
  }
}
