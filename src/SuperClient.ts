import {
  Client,
  IntentsBitField,
  Partials,
  Options,
  Collection,
  Snowflake,
  Guild,
} from 'discord.js';
import { ClusterClient, getInfo } from 'discord-hybrid-sharding';
import { commandsMap, interactionsMap } from './commands/BaseCommand.js';
import Logger from './utils/Logger.js';
import Scheduler from './structures/Scheduler.js';
import NSFWClient from './structures/NSFWDetection.js';
import CommandManager from './structures/CommandManager.js';
import NetworkManager from './structures/NetworkManager.js';
import ReactionUpdater from './updater/ReactionUpdater.js';
import BlacklistManager from './structures/BlacklistManager.js';
import { RemoveMethods } from './typings/index.js';
import Sentry from '@sentry/node';
import { isDevBuild } from './utils/Constants.js';

export default abstract class SuperClient extends Client {
  readonly logger = Logger;

  readonly description = 'The only cross-server communication bot you\'ll ever need.';
  readonly version = process.env.npm_package_version ?? 'Unknown';
  readonly commands = commandsMap;
  readonly interactions = interactionsMap;

  readonly commandCooldowns = new Collection<string, number>();
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
          lifetime: 1800,	// Remove messages older than 30 minutes.
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
    });
  }

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

  public static getInstance(): SuperClient {
    return this.self;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  resolveEval = <T>(value: any[]): T | undefined => value?.find((res) => !!res);

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
