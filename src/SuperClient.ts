import {
  Client,
  IntentsBitField,
  Partials,
  Options,
  Collection,
  Snowflake,
  Guild,
  WebhookClient,
} from 'discord.js';
import { ClusterClient, getInfo } from 'discord-hybrid-sharding';
import { commandsMap, interactionsMap } from './commands/BaseCommand.js';
import Sentry from '@sentry/node';
import Scheduler from './services/SchedulerService.js';
import NSFWClient from './utils/NSFWDetection.js';
import CommandManager from './managers/CommandManager.js';
import NetworkManager from './managers/NetworkManager.js';
import ReactionUpdater from './updater/ReactionUpdater.js';
import CooldownService from './services/CooldownService.js';
import BlacklistManager from './managers/BlacklistManager.js';
import { RemoveMethods } from './typings/index.js';
import { isDevBuild } from './utils/Constants.js';
import { ActivityType } from 'discord.js';
import 'dotenv/config';

export default abstract class SuperClient extends Client {
  readonly description = 'The only cross-server chatting bot you\'ll ever need.';
  readonly version = process.env.npm_package_version ?? 'Unknown';
  readonly commands = commandsMap;
  readonly interactions = interactionsMap;
  readonly webhooks = new Collection<string, WebhookClient>;

  readonly commandCooldowns = new CooldownService();
  readonly reactionCooldowns = new Collection<string, number>();
  readonly cluster = new ClusterClient(this);

  private readonly scheduler = new Scheduler();
  private readonly commandHandler = new CommandManager(this);
  private readonly networkHandler = new NetworkManager(this);
  private readonly blacklistManager = new BlacklistManager(this.scheduler);
  private readonly reactionUpdater = new ReactionUpdater(this);
  private readonly nsfwDetector = new NSFWClient();

  private static self: SuperClient;

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
            state: 'Watching over 500+ networks | /hub browse',
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
  protected init() {
    SuperClient.self = this;

    if (!isDevBuild) {
      // error monitoring & handling
      Sentry.init({
        dsn: process.env.SENTRY_DSN,
        release: this.version,
        tracesSampleRate: 1.0,
      });
    }
  }

  /**
   * Returns the instance of the SuperClient class.
   */
  public static getInstance(): SuperClient {
    return this.self;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  resolveEval = <T>(value: any[]): T | undefined => value?.find((res) => !!res);

  /**
   * Fetches a guild by its ID from the cache.
   * @param guildId The ID of the guild to fetch.
   * @returns The fetched guild **without any methods**, or undefined if the guild is not found.
   */
  async fetchGuild(guildId: Snowflake): Promise<RemoveMethods<Guild> | undefined> {
    const fetch = await this.cluster.broadcastEval(
      (client, guildID) => client.guilds.cache.get(guildID),
      { context: guildId },
    );

    return fetch ? this.resolveEval(fetch) : undefined;
  }

  getCommandManager(): CommandManager {
    return this.commandHandler;
  }
  getNetworkManager(): NetworkManager {
    return this.networkHandler;
  }
  getScheduler(): Scheduler {
    return this.scheduler;
  }
  getBlacklistManager(): BlacklistManager {
    return this.blacklistManager;
  }
  getReactionUpdater(): ReactionUpdater {
    return this.reactionUpdater;
  }
  getNSFWDetector(): NSFWClient {
    return this.nsfwDetector;
  }
}
