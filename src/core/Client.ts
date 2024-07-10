import Scheduler from '../services/SchedulerService.js';
import UserDbManager from '../managers/UserDbManager.js';
import CooldownService from '../services/CooldownService.js';
import loadCommandFiles, { commandsMap, interactionsMap } from '../utils/LoadCommands.js';
import ServerBlacklistManager from '../managers/ServerBlacklistManager.js';
import {
  Client,
  IntentsBitField,
  Partials,
  Options,
  Collection,
  Snowflake,
  Guild,
  WebhookClient,
  ActivityType,
} from 'discord.js';
import { getAllConnections } from '../utils/ConnectedList.js';
import { ClusterClient, getInfo } from 'discord-hybrid-sharding';
import { RemoveMethods } from '../typings/index.js';
import { loadLocales } from '../utils/Locale.js';
import { PROJECT_VERSION } from '../utils/Constants.js';
import { resolveEval } from '../utils/Utils.js';
import 'dotenv/config';

export default class SuperClient extends Client {
  // A static instance of the SuperClient class to be used globally.
  public static instance: SuperClient;

  private readonly scheduler = new Scheduler();

  readonly description = 'The only cross-server chatting bot you\'ll ever need.';
  readonly version = PROJECT_VERSION;
  readonly commands = commandsMap;
  readonly interactions = interactionsMap;

  readonly webhooks = new Collection<string, WebhookClient>();
  readonly reactionCooldowns = new Collection<string, number>();

  readonly cluster = new ClusterClient(this);
  readonly userManager = new UserDbManager(this);
  readonly serverBlacklists = new ServerBlacklistManager(this);
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
      partials: [Partials.Message, Partials.Channel],
      intents: [
        IntentsBitField.Flags.MessageContent,
        IntentsBitField.Flags.Guilds,
        IntentsBitField.Flags.GuildMembers,
        IntentsBitField.Flags.GuildMessages,
        IntentsBitField.Flags.GuildMessageReactions,
        IntentsBitField.Flags.GuildWebhooks,
      ],
      presence: {
        status: 'invisible',
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
    loadLocales('locales/src/locales');

    // load commands
    await loadCommandFiles();

    await getAllConnections({ connected: true });

    await this.login(process.env.TOKEN);
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
