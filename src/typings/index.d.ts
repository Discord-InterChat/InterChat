import { ClusterClient } from 'discord-hybrid-sharding';
import { Collection, Snowflake } from 'discord.js';
import { Logger } from 'winston';
import { Scheduler } from '../services/SchedulerService.ts';
import NSFWClient from '../utils/NSFWDetection.ts';
import NetworkManager from '../structures/NetworkManager.ts';
import BlacklistManager from '../managers/BlacklistManager.ts';
import CommandManager from '../managers/CommandManager.ts';
import CooldownService from '../services/CooldownService.ts';

type RemoveMethods<T> = {
  [K in keyof T]: T[K] extends (...args: unknown[]) => unknown ? never : RemoveMethods<T[K]>;
};

declare module 'discord.js' {
  export interface Client {
    readonly logger: Logger;
    readonly version: string;
    readonly development: boolean;
    readonly description: string;
    readonly commandCooldowns: CooldownService;
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
