import InterChatClient from '#main/core/BaseClient.js';
import { ChatLobby } from '#main/types/ChatLobby.js';
import { emojis } from '#main/utils/Constants.js';
import Logger from '#main/utils/Logger.js';
import { stripIndents } from 'common-tags';
import { ClusterClient } from 'discord-hybrid-sharding';

export default class LobbyNotifier {
  private readonly cluster: ClusterClient<InterChatClient>;

  constructor(cluster: ClusterClient<InterChatClient>) {
    this.cluster = cluster;
  }

  private async sendToChannel(channelId: string, message: string) {
    try {
      await this.cluster.broadcastEval(
        (client, ctx) => {
          const channel = client.channels.cache.get(ctx.channelId);
          if (channel?.isSendable()) channel.send(ctx.message);
        },
        { context: { channelId, message } },
      );
    }
    catch (error) {
      Logger.error('Failed to send message to channel', error);
    }
  }

  public notifychannelConnect(channelId: string, lobby: ChatLobby) {
    lobby.connections.forEach(async (connection) => {
      if (connection.channelId === channelId) return;

      await this.sendToChannel(
        connection.channelId,
        `${emojis.join} A server connected to lobby. ${lobby.connections.length} server(s) in total.`,
      );
    });
    Logger.info(`Channel ${channelId} connected to lobby.`);
  }

  public async notifychannelDisconnect(lobby: ChatLobby, channelId: string) {
    lobby.connections.forEach(async (connection) => {
      if (connection.channelId === channelId) return;
      await this.sendToChannel(connection.channelId, `-# ${emojis.info} A server disconnected from lobby.`);
    });
  }

  public async notifylobbyCreate(channelId: string, lobby: ChatLobby) {
    await this.sendToChannel(
      channelId,
      stripIndents`
        🎉 Connected to a new lobby with ${lobby.connections.length} server(s)!
        -# Messages in this channel will be shared with other servers.
      `,
    );
    Logger.info(`New lobby created. ${lobby.connections.length} servers connected.`);
  }
  public async notifyLobbyDelete(channelId: string) {
    await this.sendToChannel(
      channelId,
      `${emojis.disconnect} No more servers in the lobby. Disconnected.`,
    );
  }
}
