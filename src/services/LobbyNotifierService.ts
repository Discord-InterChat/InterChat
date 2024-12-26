import { LobbyManager } from '#main/managers/LobbyManager.js';
import { LobbyData } from '#main/types/ChatLobby.js';
import { EmojiKeys, getEmoji } from '#main/utils/EmojiUtils.js';
import Logger from '#main/utils/Logger.js';
import { stripIndents } from 'common-tags';
import { Client, WebhookClient } from 'discord.js';

export default class LobbyNotifier {
  private readonly manager: LobbyManager;
  private readonly client: Client<true>;

  constructor(manager: LobbyManager, client: Client<true>) {
    this.manager = manager;
    this.client = client;
  }

  private getEmoji(name: EmojiKeys) {
    return getEmoji(name, this.client);
  }

  private async sendToChannel(channelId: string, message: string) {
    try {
      const channel = (await this.manager.getLobbyByChannelId(channelId))?.servers.find(
        (s) => s.channelId === channelId,
      );

      if (!channel) {
        Logger.error(`[LobbyNotifier]: Channel ${channelId} not found in any lobby`);
        return;
      }
      const webhook = new WebhookClient({ url: channel.webhookUrl });
      await webhook.send({
        content: message,
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
        `${this.getEmoji('join')} A server joined the lobby. ${lobby.servers.length}/3 server(s) in total.`,
      );
    });
    Logger.info(`Channel ${channelId} connected to lobby.`);
  }

  public async notifyChannelDisconnect(lobby: LobbyData, channelId: string) {
    lobby.servers.forEach(async (server) => {
      if (server.channelId === channelId) return;
      await this.sendToChannel(
        server.channelId,
        `-# ${this.getEmoji('info')} A server disconnected from lobby.`,
      );
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
      `${this.getEmoji('disconnect')} No more servers in the lobby. Disconnected.`,
    );
  }
}
