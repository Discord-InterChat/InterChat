import { ClusterClient, getInfo } from 'discord-hybrid-sharding';
import {
  Client,
  Collection,
  GatewayIntentBits,
  type Guild,
  Options,
  type Snowflake,
  Sweepers,
} from 'discord.js';
import type BaseCommand from '#main/core/BaseCommand.js';
import type BasePrefixCommand from '#main/core/BasePrefixCommand.js';
import type { InteractionFunction } from '#main/decorators/RegisterInteractionHandler.js';
import AntiSpamManager from '#main/managers/AntiSpamManager.js';
import EventLoader from '#main/modules/Loaders/EventLoader.js';
import CooldownService from '#main/services/CooldownService.js';
import { LevelingService } from '#main/services/LevelingService.js';
import Scheduler from '#main/services/SchedulerService.js';
import { loadCommands, loadInteractions } from '#main/utils/CommandUtils.js';
import type { RemoveMethods } from '#types/CustomClientProps.d.ts';
import Constants from '#utils/Constants.js';
import { loadLocales } from '#utils/Locale.js';
import { resolveEval } from '#utils/Utils.js';

export default class InterChatClient extends Client {
  static instance: InterChatClient;

  private readonly scheduler = new Scheduler();

  public readonly commands = new Collection<string, BaseCommand>();
  public readonly interactions = new Collection<string, InteractionFunction>();
  public readonly prefixCommands = new Collection<string, BasePrefixCommand>();

  public readonly version = Constants.ProjectVersion;
  public readonly reactionCooldowns = new Collection<string, number>();
  public readonly cluster = new ClusterClient(this);
  public readonly eventLoader = new EventLoader(this);
  public readonly commandCooldowns = new CooldownService();
  public readonly antiSpamManager = new AntiSpamManager({
    spamThreshold: 4,
    timeWindow: 3000,
    spamCountExpirySecs: 60,
  });

  public readonly userLevels: LevelingService = new LevelingService();

  constructor() {
    super({
      shards: getInfo().SHARD_LIST, // An array of shards that will get spawned
      shardCount: getInfo().TOTAL_SHARDS, // Total number of shards
      makeCache: Options.cacheWithLimits({
        ThreadManager: {
          maxSize: 1000,
        },
        ReactionManager: 200,
        PresenceManager: 0,
        AutoModerationRuleManager: 0,
        VoiceStateManager: 0,
        GuildScheduledEventManager: 0,
        ApplicationCommandManager: 0,
        BaseGuildEmojiManager: 0,
        StageInstanceManager: 0,
        ThreadMemberManager: 0,
        GuildInviteManager: 0,
        GuildEmojiManager: 0,
        GuildBanManager: 0,
        DMMessageManager: 0,
      }),
      sweepers: {
        messages: {
          interval: 3600,
          filter: Sweepers.filterByLifetime({
            lifetime: 43200, // 12 hours
            getComparisonTimestamp: (message) => message.createdTimestamp,
          }),
        },
        threads: {
          interval: 60,
          filter: () => (thread) => Boolean(thread.archived || thread.locked),
        },
      },
      intents: [
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildWebhooks,
      ],
      allowedMentions: { repliedUser: false },
    });
  }

  async start() {
    // initialize the client
    InterChatClient.instance = this;

    // initialize i18n for localization
    loadLocales('locales');
    loadCommands(this.commands, this.prefixCommands, this.interactions, this);
    loadInteractions(this.interactions);
    this.eventLoader.load();

    // Discord.js automatically uses DISCORD_TOKEN env variable
    await this.login(process.env.DISCORD_TOKEN);
  }

  /**
   * Fetches a guild by its ID from the cache of one of the clusters.
   * @param guildId The ID of the guild to fetch.
   * @returns The fetched guild **without any methods**, or undefined if the guild is not found.
   */
  async fetchGuild(guildId: Snowflake): Promise<RemoveMethods<Guild> | undefined> {
    const fetch = (await this.cluster.broadcastEval(
      (client, guildID) => client.guilds.cache.get(guildID),
      { guildId, context: guildId },
    )) as Guild[];

    return fetch ? resolveEval(fetch) : undefined;
  }

  getScheduler(): Scheduler {
    return this.scheduler;
  }
}
