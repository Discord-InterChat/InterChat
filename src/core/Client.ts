import Scheduler from '../services/SchedulerService.js';
import loadCommandFiles from '../utils/LoadCommands.js';
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
import {
  connectionCache as _connectionCache,
  messageTimestamps,
  storeMsgTimestamps,
  syncConnectionCache,
} from '../utils/ConnectedList.js';
import { ClusterClient, getInfo } from 'discord-hybrid-sharding';
import { commandsMap, interactionsMap } from './BaseCommand.js';
import CooldownService from '../services/CooldownService.js';
import BlacklistManager from '../managers/BlacklistManager.js';
import { RemoveMethods } from '../typings/index.js';
import { loadLocales } from '../utils/Locale.js';
import { PROJECT_VERSION } from '../utils/Constants.js';
import 'dotenv/config';

export default class SuperClient extends Client {
  // A static instance of the SuperClient class to be used globally.
  public static instance: SuperClient;

  private _connectionCachePopulated = false;
  private readonly scheduler = new Scheduler();

  readonly description = 'The only cross-server chatting bot you\'ll ever need.';
  readonly version = PROJECT_VERSION;
  readonly commands = commandsMap;
  readonly interactions = interactionsMap;

  readonly webhooks = new Collection<string, WebhookClient>();
  readonly reactionCooldowns = new Collection<string, number>();
  readonly connectionCache = _connectionCache;

  readonly cluster = new ClusterClient(this);
  readonly blacklistManager = new BlacklistManager(this.scheduler);
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
    await loadLocales('locales/src/locales');

    // load commands
    await loadCommandFiles();

    await syncConnectionCache();
    this._connectionCachePopulated = true;

    this.scheduler.addRecurringTask(
      'populateConnectionCache',
      60_000 * 5,
      syncConnectionCache,
    );

    // store network message timestamps to connectedList every minute
    this.scheduler.addRecurringTask('storeMsgTimestamps', 60 * 1_000, () => {
      storeMsgTimestamps(messageTimestamps);
      messageTimestamps.clear();
    });


    await this.login(process.env.TOKEN);
  }

  public get cachePopulated() {
    return this._connectionCachePopulated;
  }

  static resolveEval = <T>(value: T[]) =>
    value?.find((res) => Boolean(res)) as RemoveMethods<T> | undefined;

  /**
   * Fetches a guild by its ID from the cache.
   * @param guildId The ID of the guild to fetch.
   * @returns The fetched guild **without any methods**, or undefined if the guild is not found.
   */
  async fetchGuild(guildId: Snowflake): Promise<RemoveMethods<Guild> | undefined> {
    const fetch = (await this.cluster.broadcastEval(
      (client, guildID) => client.guilds.cache.get(guildID),
      { context: guildId },
    )) as Guild[];

    return fetch ? SuperClient.resolveEval(fetch) : undefined;
  }

  getScheduler(): Scheduler {
    return this.scheduler;
  }
}
