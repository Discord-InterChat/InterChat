import Scheduler from '#main/modules/SchedulerService.js';
import BaseCommand from '#main/core/BaseCommand.js';
import UserDbManager from '#main/modules/UserDbManager.js';
import ServerBlacklistManager from '#main/modules/ServerBlacklistManager.js';
import { ClusterClient } from 'discord-hybrid-sharding';
import { InteractionFunction } from '#main/decorators/Interaction.ts';
import {
  Collection,
  Snowflake,
  Channel,
  NewsChannel,
  TextChannel,
  ForumChannel,
  MediaChannel,
  StageChannel,
  VoiceChannel,
} from 'discord.js';
import CooldownService from '#main/modules/CooldownService.js';

type RemoveMethods<T> = {
  [K in keyof T]: T[K] extends (...args: unknown[]) => unknown ? never : RemoveMethods<T[K]>;
};

type ThreadParentChannel = NewsChannel | TextChannel | ForumChannel | MediaChannel;

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
    readonly serverBlacklists: ServerBlacklistManager;

    fetchGuild(guildId: Snowflake): Promise<RemoveMethods<Guild> | undefined>;
    getScheduler(): Scheduler;
    isGuildTextBasedChannel(channel: Channel | null | undefined): channel is GuildTextBasedChannel;
  }
}
