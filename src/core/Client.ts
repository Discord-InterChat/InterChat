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
import Sentry from '@sentry/node';
import Scheduler from '../services/SchedulerService.js';
import NSFWClient from '../utils/NSFWDetection.js';
import CommandManager from '../managers/CommandManager.js';
import NetworkManager from '../managers/NetworkManager.js';
import ReactionUpdater from '../updater/ReactionUpdater.js';
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
import { supportedLocaleCodes } from '../utils/Locale.js';

export default abstract class SuperClient<R extends boolean = boolean> extends Client<R> {
  // A static instance of the SuperClient class to be used globally.
  public static instance: SuperClient;

  private readonly scheduler = new Scheduler();

  readonly description = "The only cross-server chatting bot you'll ever need.";
  readonly version = process.env.npm_package_version ?? 'Unknown';
  readonly commands = commandsMap;
  readonly interactions = interactionsMap;
  readonly webhooks = new Collection<string, WebhookClient>();

  readonly commandCooldowns = new CooldownService();
  readonly reactionCooldowns = new Collection<string, number>();
  readonly cluster = new ClusterClient(this);
  readonly commandManager = new CommandManager(this);
  readonly networkManager = new NetworkManager();
  readonly blacklistManager = new BlacklistManager(this.scheduler);
  readonly nsfwDetector = new NSFWClient();
  readonly reportLogger = new ReportLogger(this);
  readonly reactionUpdater = new ReactionUpdater(this);
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
      ],
      presence: {
        status: 'idle',
        activities: [
          {
            state: 'Watching over 200+ cross-server hubs',
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
  protected boot() {
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
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static resolveEval = <T>(value: T[]) =>
    value?.find((res) => !!res) as RemoveMethods<T> | undefined;

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
