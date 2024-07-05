import Scheduler from '../services/SchedulerService.ts';
import BaseCommand from '../core/BaseCommand.ts';
import CooldownService from '../services/CooldownService.ts';
import UserDbManager from '../managers/UserDbManager.ts';
import ServerBlacklisManager from '../managers/ServerBlacklistManager.ts';
import { ClusterClient } from 'discord-hybrid-sharding';
import { InteractionFunction } from '../decorators/Interaction.ts';
import { supportedLocaleCodes } from '../utils/Locale.ts';
import { Collection, Snowflake } from 'discord.js';

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
    readonly userManager: UserDbManager;
    readonly serverBlacklists: ServerBlacklisManager;

    fetchGuild(guildId: Snowflake): Promise<RemoveMethods<Guild> | undefined>;
    getScheduler(): Scheduler;
  }

  export interface User {
    locale?: supportedLocaleCodes;
  }
}
