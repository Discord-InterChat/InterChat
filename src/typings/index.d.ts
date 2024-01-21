import { ClusterClient } from 'discord-hybrid-sharding';
import { Collection, Snowflake } from 'discord.js';
import { Scheduler } from '../services/SchedulerService.ts';
import NSFWClient from '../utils/NSFWDetection.ts';
import NetworkManager from '../managers/NetworkManager.ts';
import BlacklistManager from '../managers/BlacklistManager.ts';
import CommandManager from '../managers/CommandManager.ts';
import CooldownService from '../services/CooldownService.ts';
import { JoinLeaveLogger, ModLogsLogger, ProfanityLogger, ReportLogger } from '../services/HubLoggerService.ts';

type RemoveMethods<T> = {
  [K in keyof T]: T[K] extends (...args: unknown[]) => unknown ? never : RemoveMethods<T[K]>;
};

declare module 'discord.js' {
  export interface Client {
    readonly version: string;
    readonly development: boolean;
    readonly description: string;
    readonly commandCooldowns: CooldownService;
    readonly reactionCooldowns: Collection<string, number>;
    readonly cluster: ClusterClient<Client>;
    readonly webhooks: Collection<string, WebhookClient>;
    readonly reportLogger: ReportLogger;
    readonly profanityLogger: ProfanityLogger;
    readonly modLogsLogger: ModLogsLogger;
    readonly joinLeaveLogger: JoinLeaveLogger;

    resolveEval: <T>(value: T[]) => T | undefined;

    getUserLocale(userId: Snowflake): Promise<string>
    fetchGuild(guildId: Snowflake): Promise<RemoveMethods<Guild> | undefined>;
    getScheduler(): Scheduler;
    getCommandManager(): CommandManager;
    getNetworkManager(): NetworkManager;
    getBlacklistManager(): BlacklistManager;
    getNSFWDetector(): NSFWClient;
  }

  export interface User {
    locale?: string;
  }
}
