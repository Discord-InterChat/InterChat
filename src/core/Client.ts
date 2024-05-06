import {
  Client as Client,
  IntentsBitField,
  Partials,
  Options,
  Collection,
  Snowflake,
  Guild,
  WebhookClient,
} from 'discord.js';
import { ClusterClient, getInfo } from 'discord-hybrid-sharding';
import { commandsMap, interactionsMap } from './BaseCommand.js';
import db from '../utils/Db.js';
import Sentry, { captureException } from '@sentry/node';
import Scheduler from '../services/SchedulerService.js';
import NSFWClient from '../utils/NSFWDetection.js';
import CommandManager from '../managers/CommandManager.js';
import ReactionUpdater from '../utils/ReactionUpdater.js';
import CooldownService from '../services/CooldownService.js';
import BlacklistManager from '../managers/BlacklistManager.js';
import { RemoveMethods } from '../typings/index.js';
import { isDevBuild } from '../utils/Constants.js';
import { ActivityType } from 'discord.js';
import {
  JoinLeaveLogger,
  ModLogsLogger,
  ProfanityLogger,
  ReportLogger,
} from '../services/HubLoggerService.js';
import 'dotenv/config';
import { loadLocales, supportedLocaleCodes } from '../utils/Locale.js';
import EventManager from '../managers/EventManager.js';
import { connectedList } from '@prisma/client';
import Logger from '../utils/Logger.js';

export default class SuperClient<R extends boolean = boolean> extends Client<R> {
  // A static instance of the SuperClient class to be used globally.
  public static instance: SuperClient;

  // classes
  private readonly reactionUpdater = new ReactionUpdater();
  private readonly eventManager = EventManager;

  private _connectionCache: Collection<string, connectedList> = new Collection();
  private _cachePopulated: boolean = false;
  private readonly scheduler = new Scheduler();

  readonly description = 'The only cross-server chatting bot you\'ll ever need.';
  readonly version = process.env.npm_package_version ?? 'Unknown';
  readonly commands = commandsMap;
  readonly interactions = interactionsMap;

  readonly webhooks = new Collection<string, WebhookClient>();
  readonly reactionCooldowns = new Collection<string, number>();

  readonly nsfwDetector = new NSFWClient();
  readonly commandManager = new CommandManager();
  readonly commandCooldowns = new CooldownService();
  readonly reportLogger = new ReportLogger(this);
  readonly cluster = new ClusterClient(this);
  readonly blacklistManager = new BlacklistManager(this.scheduler);
  readonly profanityLogger = new ProfanityLogger(this);
  readonly modLogsLogger = new ModLogsLogger(this);
  readonly joinLeaveLogger = new JoinLeaveLogger(this);

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
      partials: [Partials.Message],
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
    if (!isDevBuild) {
      // error monitoring & handling
      Sentry.init({
        dsn: process.env.SENTRY_DSN,
        release: this.version,
        tracesSampleRate: 1.0,
        maxValueLength: 1000,
      });
    }

    // initialize i18n for localization
    loadLocales('locales/src/locales');

    // load commands
    await CommandManager.loadCommandFiles();

    await this.populateConnectionCache();
    this.getScheduler().addRecurringTask('populateConnectionCache', 60_000 * 5, async () => {
      await this.populateConnectionCache().catch(captureException);
    });

    await this.login(process.env.TOKEN);
  }

  protected async populateConnectionCache() {
    Logger.debug('[InterChat]: Populating connection cache.');
    const connections = await db.connectedList.findMany({ where: { connected: true } });

    // populate all at once without time delay
    this._connectionCache = new Collection(connections.map((c) => [c.channelId, c]));
    this._cachePopulated = true;
    Logger.debug(
      `[InterChat]: Connection cache populated with ${this._connectionCache.size} entries.`,
    );
  }

  public get connectionCache() {
    return this._connectionCache;
  }
  public get cachePopulated() {
    return this._cachePopulated;
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

  async getUserLocale(userId: Snowflake) {
    const fetch = await db.userData.findFirst({ where: { userId } });

    return (fetch?.locale as supportedLocaleCodes | undefined) || 'en';
  }

  getScheduler(): Scheduler {
    return this.scheduler;
  }
}
