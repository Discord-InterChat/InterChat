import {
  Client,
  IntentsBitField,
  Partials,
  Options,
  Collection,
  Guild,
  Snowflake,
} from 'discord.js';
import { ClusterClient, getInfo } from 'discord-hybrid-sharding';
import { commandsMap, interactionsMap } from './commands/Command.js';
import Logger from './utils/Logger.js';
import Scheduler from './structures/Scheduler.js';
import NSFWClient from './structures/NSFWDetection.js';
import CommandManager from './structures/CommandManager.js';
import NetworkManager from './structures/NetworkManager.js';
import ReactionUpdater from './updater/ReactionUpdater.js';
import BlacklistManager from './structures/BlacklistManager.js';

export default abstract class SuperClient extends Client {
  readonly logger = Logger;

  readonly description = 'The only cross-server communication bot you\'ll ever need.';
  readonly version = process.env.npm_package_version ?? 'Unknown';
  readonly commands = commandsMap;
  readonly components = interactionsMap;

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
      partials: [Partials.Message],
      intents: [
        IntentsBitField.Flags.MessageContent,
        IntentsBitField.Flags.Guilds,
        IntentsBitField.Flags.GuildMembers,
        IntentsBitField.Flags.GuildMessages,
        IntentsBitField.Flags.GuildMessageReactions,
      ],
      presence: { status: 'invisible' },
    });
  }

  protected init() {
    SuperClient.self = this;
  }

  public static getInstance(): SuperClient {
    return this.self;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private resolveEval = <T>(value: any[]): T | undefined => value?.find((res) => !!res);

  async fetchGuild(guildId: Snowflake): Promise<Guild | undefined> {
    const fetch = await this.shard?.broadcastEval(
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
