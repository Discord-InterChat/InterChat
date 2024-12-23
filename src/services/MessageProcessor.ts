import { showRulesScreening } from '#main/interactions/RulesScreening.js';
import { LobbyManager } from '#main/managers/LobbyManager.js';
import Constants, { emojis } from '#main/utils/Constants.js';
import { checkBlockedWords } from '#main/utils/network/blockwordsRunner.js';
import { runChecks } from '#main/utils/network/runChecks.js';
import { check } from '#main/utils/ProfanityUtils.js';
import { containsInviteLinks, handleError } from '#main/utils/Utils.js';
import type { LobbyData } from '#types/ChatLobby.d.ts';
import type { ConnectionData } from '#types/ConnectionTypes.d.ts';
import { Message, WebhookClient } from 'discord.js';
import { BroadcastService } from './BroadcastService.js';

export class MessageProcessor {
  private readonly broadcastService: BroadcastService;

  constructor() {
    this.broadcastService = new BroadcastService();
  }

  async processLobbyMessage(message: Message<true>, lobby: LobbyData) {
    await this.updateLobbyActivity(message, lobby);

    if (
      containsInviteLinks(message.content) ||
      message.attachments.size > 0 ||
      Constants.Regex.ImageURL.test(message.content) ||
      check(message.content).hasSlurs
    ) {
      message.react(`${emojis.no}`).catch(() => null);
      return;
    }

    for (const server of lobby.servers) {
      if (server.channelId === message.channelId) continue;

      try {
        const webhook = new WebhookClient({ url: server.webhookUrl });
        await webhook.send({
          username: message.author.username,
          avatarURL: message.author.displayAvatarURL(),
          content: message.content,
          allowedMentions: { parse: [] },
        });
      }
      catch (err) {
        err.message = `Failed to send message to ${server.channelId}: ${err.message}`;
        handleError(err);
      }
    }
  }

  async processHubMessage(message: Message<true>, connectionData: ConnectionData) {
    const { connection, hub, hubConnections } = connectionData;
    const { userManager } = message.client;

    const userData = await userManager.getUser(message.author.id);
    if (!userData?.acceptedRules) return await showRulesScreening(message, userData);

    const attachmentURL = await this.broadcastService.resolveAttachmentURL(message);

    if (
      !(await runChecks(message, hub, {
        userData,
        settings: hub.settings,
        attachmentURL,
        totalHubConnections: hubConnections.length,
      }))
    ) {
      return;
    }

    message.channel.sendTyping().catch(() => null);

    const { passed } = await checkBlockedWords(message, await hub.fetchBlockWords());
    if (!passed) return;

    await this.broadcastService.broadcastMessage(message, hub, hubConnections, connection);
  }

  private async updateLobbyActivity(message: Message<true>, lobby: LobbyData) {
    const lobbyManager = new LobbyManager();
    await lobbyManager.updateLastMessageTimestamp(lobby.id, message.guildId);
  }
}
