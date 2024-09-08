import CooldownService from '#main/modules/CooldownService.js';
import EventHandler from '#main/modules/EventHandler.js';
import Scheduler from '#main/modules/SchedulerService.js';
import ServerBlacklistManager from '#main/modules/ServerBlacklistManager.js';
import UserDbManager from '#main/modules/UserDbManager.js';
import { commandsMap, interactionsMap, loadCommandFiles } from '#main/utils/LoadCommands.js';
import { RandomComponents } from '#main/utils/RandomComponents.js';
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
import { RemoveMethods } from '../typings/index.js';
import Constants from '../utils/Constants.js';
import { loadLocales } from '../utils/Locale.js';
import { resolveEval } from '../utils/Utils.js';

export default class SuperClient extends Client {
  public static instance: SuperClient;

  private readonly scheduler = new Scheduler();
  readonly _componentListeners = new RandomComponents();

  readonly description = 'The only cross-server chatting bot you\'ll ever need.';
  readonly version = Constants.ProjectVersion;
  readonly commands = commandsMap;
  readonly interactions = interactionsMap;

  readonly webhooks = new Collection<string, WebhookClient>();
  readonly reactionCooldowns = new Collection<string, number>();

  readonly cluster = new ClusterClient(this);
  readonly userManager = new UserDbManager(this);
  readonly serverBlacklists = new ServerBlacklistManager(this);
  readonly eventHandler = new EventHandler(this);
  readonly commandCooldowns = new CooldownService();

  constructor() {
    super({
      shards: getInfo().SHARD_LIST, // An array of shards that will get spawned
      shardCount: getInfo().TOTAL_SHARDS, // Total number of shards
      makeCache: Options.cacheWithLimits({
        MessageManager: 200,
        PresenceManager: 0,
        ReactionManager: 200,
      }),
      sweepers: {
        ...Options.DefaultSweeperSettings,
        messages: {
          interval: 3600, // Every hour...
          lifetime: 1800, // Remove messages older than 30 minutes.
        },
        reactions: {
          interval: 3600, // Every hour...
          filter: () => () => true, // Remove all reactions...
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
    SuperClient.instance = this;

    // initialize i18n for localization
    loadLocales('locales/locales');

    // load commands
    await loadCommandFiles({ loadInteractions: true });
    this.eventHandler.loadListeners();

    // Discord.js automatically uses DISCORD_TOKEN env variable
    await this.login();
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
