import { Message } from 'discord.js';
import type { ChatLobby } from '#types/ChatLobby.d.ts';
import type { ConnectionData } from '#types/ConnectionTypes.d.ts';
import { BroadcastService } from './BroadcastService.js';
import HubSettingsManager from '#main/managers/HubSettingsManager.js';
import { checkBlockedWords } from '#main/utils/network/blockwordsRunner.js';
import { runChecks } from '#main/utils/network/runChecks.js';
import { showRulesScreening } from '#main/interactions/RulesScreening.js';
import storeLobbyMessageData from '#main/utils/lobby/storeLobbyMessageData.js';
import { handleError } from '#main/utils/Utils.js';

export class MessageProcessor {
  private readonly broadcastService: BroadcastService;

  constructor() {
    this.broadcastService = new BroadcastService();
  }

  async processLobbyMessage(message: Message<true>, lobby: ChatLobby) {
    await this.updateLobbyActivity(message, lobby);

    for (const server of lobby.connections) {
      if (server.channelId === message.channelId) continue;

      try {
        await message.client.cluster.broadcastEval(
          async (c, { channelId, content }) => {
            const channel = await c.channels.fetch(channelId);
            if (channel?.isSendable()) {
              await channel.send({ content, allowedMentions: { parse: [] } });
            }
          },
          {
            context: {
              channelId: server.channelId,
              content: `**${message.author.username}**: ${message.content}`,
            },
            guildId: server.serverId,
          },
        );
      }
      catch (err) {
        err.message = `Failed to send message to ${server.channelId}: ${err.message}`;
        handleError(err);
      }

      await storeLobbyMessageData(lobby, message);

    }
  }

  async processHubMessage(message: Message<true>, connectionData: ConnectionData) {
    const { connection, hub, hubConnections } = connectionData;
    const { userManager } = message.client;

    const userData = await userManager.getUser(message.author.id);
    if (!userData?.acceptedRules) return await showRulesScreening(message, userData);

    const settings = new HubSettingsManager(hub.id, hub.settings);
    const attachmentURL = await this.broadcastService.resolveAttachmentURL(message);

    if (
      !(await runChecks(message, hub, {
        userData,
        settings,
        attachmentURL,
        totalHubConnections: hubConnections.length,
      }))
    ) {
      return;
    }

    message.channel.sendTyping().catch(() => null);

    const { passed } = await checkBlockedWords(message, hub.msgBlockList);
    if (!passed) return;

    await this.broadcastService.broadcastMessage(
      message,
      hub,
      hubConnections,
      settings,
      connection,
    );
  }

  private async updateLobbyActivity(message: Message<true>, lobby: ChatLobby) {
    const { lobbyService } = message.client;
    await lobbyService.updateActivity(lobby.id, message.channelId);
  }
}
