import { LobbyManager } from '#main/managers/LobbyManager.js';
import { LobbyData } from '#main/types/ChatLobby.js';
import { emojis } from '#main/utils/Constants.js';
import Logger from '#main/utils/Logger.js';
import { stripIndents } from 'common-tags';
import { WebhookClient } from 'discord.js';

export default class LobbyNotifier {
  private readonly manager: LobbyManager;

  constructor(manager = new LobbyManager()) {
    this.manager = manager;
  }

  private async sendToChannel(channelId: string, message: string) {
    try {
      const channel = (await this.manager.getLobbyByChannelId(channelId))?.servers
        .find((s) => s.channelId === channelId);

      if (!channel) {
        Logger.error(`[LobbyNotifier]: Channel ${channelId} not found in any lobby`);
        return;
      }
      const webhook = new WebhookClient({ url: channel.webhookUrl });
      await webhook.send({
        content:  message,
        username: 'InterChat Lobby Notification',
        allowedMentions: { parse: [] },
      });
    }
    catch (error) {
      Logger.error('Failed to send lobby notification to channel', error);
    }
  }

  public notifyChannelConnect(channelId: string, lobby: LobbyData) {
    lobby.servers.forEach(async (server) => {
      if (server.channelId === channelId) return;

      await this.sendToChannel(
        server.channelId,
        `${emojis.join} A server joined the lobby. ${lobby.servers.length}/3 server(s) in total.`,
      );
    });
    Logger.info(`Channel ${channelId} connected to lobby.`);
  }

  public async notifyChannelDisconnect(lobby: LobbyData, channelId: string) {
    lobby.servers.forEach(async (server) => {
      if (server.channelId === channelId) return;
      await this.sendToChannel(server.channelId, `-# ${emojis.info} A server disconnected from lobby.`);
    });
  }

  public async notifyLobbyCreate(channelId: string, lobby: LobbyData) {
    await this.sendToChannel(
      channelId,
      stripIndents`
        🎉 Connected to a new lobby with ${lobby.servers.length}/3 server(s)!
        -# Messages in this channel will be shared with other servers.
      `,
    );
    Logger.info(`New lobby ${lobby.id} created for ${lobby.servers.map((c) => c.serverId)}`);
  }
  public async notifyLobbyDelete(channelId: string) {
    await this.sendToChannel(
      channelId,
      `${emojis.disconnect} No more servers in the lobby. Disconnected.`,
    );
  }
}
