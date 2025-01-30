import type { ClusterClient } from 'discord-hybrid-sharding';
import type {
  Collection,
  ForumChannel,
  MediaChannel,
  NewsChannel,
  Snowflake,
  TextChannel,
} from 'discord.js';
import type BaseCommand from '#src/core/BaseCommand.js';
import type BasePrefixCommand from '#src/core/BasePrefixCommand.js';
import type { InteractionFunction } from '#src/decorators/RegisterInteractionHandler.js';
import type AntiSpamManager from '#src/managers/AntiSpamManager.js';
import type EventLoader from '#src/modules/Loaders/EventLoader.js';
import type CooldownService from '#src/services/CooldownService.js';
import type Scheduler from '#src/services/SchedulerService.js';
import { LevelingService } from '#src/services/LevelingService.js';

export type RemoveMethods<T> = {
  [K in keyof T]: T[K] extends (...args: unknown[]) => unknown ? never : RemoveMethods<T[K]>;
};

export type ThreadParentChannel = NewsChannel | TextChannel | ForumChannel | MediaChannel;

declare module 'discord.js' {
  export interface Client {
    readonly version: string;
    readonly development: boolean;
    readonly description: string;
    readonly commands: Collection<string, BaseCommand>;
    readonly interactions: Collection<string, InteractionFunction>;
    readonly prefixCommands: Collection<string, BasePrefixCommand>;

    readonly eventLoader: EventLoader;
    readonly commandCooldowns: CooldownService;
    readonly reactionCooldowns: Collection<string, number>;
    readonly cluster: ClusterClient<Client>;
    readonly antiSpamManager: AntiSpamManager;

    readonly userLevels: LevelingService;

    fetchGuild(guildId: Snowflake): Promise<RemoveMethods<Guild> | undefined>;
    getScheduler(): Scheduler;
  }
}
