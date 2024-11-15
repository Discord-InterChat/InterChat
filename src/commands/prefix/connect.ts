import BasePrefixCommand, { CommandData } from '#main/core/BasePrefixCommand.js';
import { LobbyManager } from '#main/managers/LobbyManager.js';
import { MatchingService } from '#main/services/LobbyMatchingService.js';
import { emojis } from '#main/utils/Constants.js';
import db from '#main/utils/Db.js';
import { t } from '#main/utils/Locale.js';
import { getOrCreateWebhook } from '#main/utils/Utils.js';
import { stripIndents } from 'common-tags';
import { Message, PermissionsBitField } from 'discord.js';

export default class BlacklistPrefixCommand extends BasePrefixCommand {
  public readonly data: CommandData = {
    name: 'connect',
    description: 'Connect to a random lobby',
    category: 'Moderation',
    usage: 'connect ` [minimum number of servers] `',
    examples: ['c', 'call', 'call 3'],
    aliases: ['call', 'c', 'conn', 'joinlobby', 'jl'],
    requiredBotPermissions: new PermissionsBitField([
      'SendMessages',
      'EmbedLinks',
      'ReadMessageHistory',
    ]),
    dbPermission: false,
    requiredArgs: 0,
  };

  private readonly lobbyManager = new LobbyManager();
  private readonly matching = new MatchingService();

  protected async run(message: Message<true>, args: string[]) {
    const minServers = parseInt(args[0], 10) || 2;

    const alreadyInLobby = await this.lobbyManager.getLobbyByChannelId(message.channelId);
    if (alreadyInLobby) {
      await message.reply('You are already chatting in a lobby. Please leave it first.');
      return;
    }

    const inWaitingPool = await this.lobbyManager.getChannelFromWaitingPool(message.guildId);
    if (inWaitingPool) {
      await message.reply(
        stripIndents`
        -# **💡 Did you know?** You can change the minimum number of servers required to find a match: \`c!call 2\`. It can be faster sometimes!
        You are already in the waiting pool for a lobby.
        -# You will be notified once a lobby is found.
      `,
      );
      return;
    }

    const webhook = await getOrCreateWebhook(
      message.channel,
      'https://i.imgur.com/80nqtSg.png',
      'InterChat Lobby',
    );
    if (!webhook) {
      await message.reply(
        t('errors.missingPermissions', 'en', { emoji: emojis.no, permissions: 'Manage Webhooks' }),
      );
      return;
    }

    const serverId = message.guildId;
    const channelId = message.channelId;

    // TODO: a way to modify this
    const serverPrefs = await db.serverPreference.findUnique({
      where: { serverId },
    });

    const preferences = {
      premiumStatus: serverPrefs?.premiumStatus ?? false,
      maxServersInLobby: minServers ?? 2,
    };

    // Add server to waiting pool for matching
    await this.lobbyManager.addToWaitingPool(
      { serverId, channelId, webhookUrl: webhook.url },
      preferences,
    );

    // Set timeout for 5 minutes
    setTimeout(
      async () => {
        await this.lobbyManager.removeFromWaitingPool(serverId);
        await message.reply('Please try again later. No lobbies were found for this server.');
      },
      5 * 60 * 1000, // 5 minutes
    );

    const match = await this.matching.findMatch(serverId, preferences);
    if (match) {
      const lobbyId = await this.lobbyManager.createLobby([
        { serverId, channelId, webhookUrl: webhook.url },
        match,
      ]);

      // Update server histories
      await this.updateServerHistory(serverId, lobbyId);
      await this.updateServerHistory(match.serverId, lobbyId);
    }
    else {
      await message.reply(
        stripIndents`
        -# **💡 Did you know?** You can change the minimum number of servers required to find a match: \`c!call 2\`. It can be faster sometimes!
        Finding a lobby for this server... Hang tight!
        -# You will be notified once a lobby is found.
      `,
      );
    }
  }
  private async updateServerHistory(serverId: string, lobbyId: string): Promise<void> {
    await db.serverHistory.upsert({
      where: { serverId },
      update: {
        recentLobbies: {
          push: { lobbyId, timestamp: Date.now() },
        },
      },
      create: {
        serverId,
        recentLobbies: [{ lobbyId, timestamp: Date.now() }],
      },
    });
  }
}
