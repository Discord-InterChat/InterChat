import { ClusterClient } from 'discord-hybrid-sharding';
import { Collection, Snowflake } from 'discord.js';
import { Scheduler } from '../services/SchedulerService.ts';
import NSFWClient from '../utils/NSFWDetection.ts';
import BlacklistManager from '../managers/BlacklistManager.ts';
import CommandManager from '../managers/CommandManager.ts';
import CooldownService from '../services/CooldownService.ts';
import {
  JoinLeaveLogger,
  ModLogsLogger,
  ProfanityLogger,
  ReportLogger,
} from '../services/HubLoggerService.ts';
import { supportedLocaleCodes } from '../utils/Locale.ts';
import { connectedList } from '@prisma/client';
import BaseCommand from '../core/BaseCommand.ts';
import { InteractionFunction } from '../decorators/Interaction.ts';

type RemoveMethods<T> = {
  [K in keyof T]: T[K] extends (...args: unknown[]) => unknown ? never : RemoveMethods<T[K]>;
};

declare module 'discord.js' {
  export interface Client {
    readonly version: string;
    readonly development: boolean;
    readonly description: string;
    readonly commands: Collection<string, BaseCommand>;
    readonly interactions: Collection<string, InteractionFunction | undefined>;

    readonly commandCooldowns: CooldownService;
    readonly reactionCooldowns: Collection<string, number>;
    readonly cluster: ClusterClient<Client>;
    readonly webhooks: Collection<string, WebhookClient>;
    readonly reportLogger: ReportLogger;
    readonly profanityLogger: ProfanityLogger;
    readonly modLogsLogger: ModLogsLogger;
    readonly joinLeaveLogger: JoinLeaveLogger;

    getUserLocale(userId: Snowflake): Promise<supportedLocaleCodes>;
    fetchGuild(guildId: Snowflake): Promise<RemoveMethods<Guild> | undefined>;
    getScheduler(): Scheduler;

    get connectionCache(): Collection<string, connectedList>;
    get cachePopulated(): boolean;

    commandManager: CommandManager;
    blacklistManager: BlacklistManager;
    nsfwDetector: NSFWClient;
  }

  export interface User {
    locale?: supportedLocaleCodes;
  }
}
