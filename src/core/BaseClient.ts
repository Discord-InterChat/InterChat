import Constants from '#main/config/Constants.js';
import type BaseCommand from '#main/core/BaseCommand.js';
import type { InteractionFunction } from '#main/decorators/Interaction.js';
import UserDbManager from '#main/managers/UserDbManager.js';
import CooldownService from '#main/modules/CooldownService.js';
import EventLoader from '#main/modules/Loaders/EventLoader.js';
import Scheduler from '#main/modules/SchedulerService.js';
import { loadCommandFiles, loadInteractions } from '#main/utils/CommandUtils.js';
import { loadLocales } from '#main/utils/Locale.js';
import { resolveEval } from '#main/utils/Utils.js';
import type { RemoveMethods } from '#types/index.d.ts';
import { ClusterClient, getInfo } from 'discord-hybrid-sharding';
import {
  type Guild,
  type Snowflake,
  type WebhookClient,
  ActivityType,
  Client,
  Collection,
  GatewayIntentBits,
  Options,
} from 'discord.js';

export default class InterChatClient extends Client {
  static instance: InterChatClient;

  private readonly scheduler = new Scheduler();

  readonly description = 'The only cross-server chatting bot you\'ll ever need.';
  readonly version = Constants.ProjectVersion;

  readonly webhooks = new Collection<string, WebhookClient>();
  readonly reactionCooldowns = new Collection<string, number>();

  readonly userManager = new UserDbManager();
  readonly cluster = new ClusterClient(this);
  readonly eventLoader = new EventLoader(this);
  readonly commandCooldowns = new CooldownService();
  public readonly commands = new Collection<string, BaseCommand>();
  public readonly interactions = new Collection<string, InteractionFunction>();

  constructor() {
    super({
      shards: getInfo().SHARD_LIST, // An array of shards that will get spawned
      shardCount: getInfo().TOTAL_SHARDS, // Total number of shards
      makeCache: Options.cacheWithLimits({
        MessageManager: 200,
        PresenceManager: 0,
        ReactionManager: 200,
      }),
      intents: [
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildWebhooks,
      ],
      presence: {
        status: 'online',
        activities: [
          {
            state: '🔗 Watching over 700+ cross-server chats',
            name: 'custom',
            type: ActivityType.Custom,
          },
        ],
      },
    });
  }

  /**
   * Initializes the SuperClient instance.
   * Sets the instance to the current object and initializes Sentry error monitoring and handling if not in development mode.
   */
  async start() {
    // initialize the client
    InterChatClient.instance = this;

    // initialize i18n for localization
    loadLocales('locales');

    // load commands
    loadCommandFiles(this.commands, this.interactions);
    loadInteractions(this.interactions);
    this.eventLoader.load();

    // Discord.js automatically uses DISCORD_TOKEN env variable
    await this.login(process.env.DISCORD_TOKEN);
  }

  /**
   * Fetches a guild by its ID from the cache.
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
