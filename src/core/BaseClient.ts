import type BaseCommand from '#main/core/BaseCommand.js';
import type BasePrefixCommand from '#main/core/BasePrefixCommand.js';
import type { InteractionFunction } from '#main/decorators/RegisterInteractionHandler.js';
import AntiSpamManager from '#main/managers/AntiSpamManager.js';
import UserDbManager from '#main/managers/UserDbManager.js';
import EventLoader from '#main/modules/Loaders/EventLoader.js';
import LobbyNotifier from '#main/modules/LobbyNotifier.js';
import ChatLobbyService from '#main/services/ChatLobbyService.js';
import CooldownService from '#main/services/CooldownService.js';
import Scheduler from '#main/services/SchedulerService.js';
import type { RemoveMethods } from '#types/CustomClientProps.d.ts';
import { loadCommands, loadInteractions } from '#utils/CommandUtils.js';
import Constants from '#utils/Constants.js';
import { loadLocales } from '#utils/Locale.js';
import { resolveEval } from '#utils/Utils.js';
import { ClusterClient, getInfo } from 'discord-hybrid-sharding';
import {
  type Guild,
  type Snowflake,
  ActivityType,
  Client,
  Collection,
  GatewayIntentBits,
  Options,
} from 'discord.js';

export default class InterChatClient extends Client {
  static instance: InterChatClient;

  private readonly scheduler = new Scheduler();

  public readonly description = 'The only cross-server chatting bot you\'ll ever need.';
  public readonly version = Constants.ProjectVersion;

  public readonly reactionCooldowns = new Collection<string, number>();
  public readonly commands = new Collection<string, BaseCommand>();
  public readonly interactions = new Collection<string, InteractionFunction>();
  public readonly prefixCommands = new Collection<string, BasePrefixCommand>();

  public readonly userManager = new UserDbManager();
  public readonly cluster = new ClusterClient(this);
  public readonly eventLoader = new EventLoader(this);
  public readonly commandCooldowns = new CooldownService();
  public readonly lobbyService = new ChatLobbyService(new LobbyNotifier(this.cluster));
  public readonly antiSpamManager = new AntiSpamManager({
    spamThreshold: 4,
    timeWindow: 5000,
    spamCountExpirySecs: 60,
  });

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

  async start() {
    // initialize the client
    InterChatClient.instance = this;

    // initialize i18n for localization
    loadLocales('locales');

    // load commands
    loadCommands(this.commands, this.prefixCommands, this.interactions);
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
