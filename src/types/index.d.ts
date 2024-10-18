import BaseCommand from '#main/core/BaseCommand.js';
import { InteractionFunction } from '#main/decorators/Interaction.ts';
import AntiSpamManager from '#main/managers/AntiSpamManager.js';
import UserDbManager from '#main/managers/UserDbManager.js';
import CooldownService from '#main/modules/CooldownService.js';
import Scheduler from '#main/modules/SchedulerService.js';
import { ClusterClient } from 'discord-hybrid-sharding';
import {
  Collection,
  ForumChannel,
  MediaChannel,
  NewsChannel,
  Snowflake,
  TextChannel,
} from 'discord.js';

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
    readonly interactions: Collection<string, InteractionFunction | undefined>;

    readonly commandCooldowns: CooldownService;
    readonly reactionCooldowns: Collection<string, number>;
    readonly cluster: ClusterClient<Client>;
    readonly userManager: UserDbManager;
    readonly antiSpamManager: AntiSpamManager;

    fetchGuild(guildId: Snowflake): Promise<RemoveMethods<Guild> | undefined>;
    getScheduler(): Scheduler;
  }
}
