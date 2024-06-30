import { ClusterClient } from 'discord-hybrid-sharding';
import { Collection, Snowflake } from 'discord.js';
import Scheduler from '../services/SchedulerService.ts';
import BaseCommand from '../core/BaseCommand.ts';
import CooldownService from '../services/CooldownService.ts';
import { supportedLocaleCodes } from '../utils/Locale.ts';
import { InteractionFunction } from '../decorators/Interaction.ts';
import { connectionCache } from '../utils/ConnectedList.ts';
import UserBlacklistManager from '../managers/UserBlacklistManager.ts';
import ServerBlacklisManager from '../managers/ServerBlacklistManager.ts';

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
    readonly connectionCache: typeof connectionCache;

    fetchGuild(guildId: Snowflake): Promise<RemoveMethods<Guild> | undefined>;
    getScheduler(): Scheduler;

    get cachePopulated(): boolean;

    readonly userBlacklists: UserBlacklistManager;
    readonly serverBlacklists: ServerBlacklisManager;
  }

  export interface User {
    locale?: supportedLocaleCodes;
  }
}
