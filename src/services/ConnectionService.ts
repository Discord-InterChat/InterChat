import { HubService } from '#main/services/HubService.js';
import type { ConnectionData } from '#types/ConnectionTypes.d.ts';
import { getConnectionHubId, getHubConnections } from '#utils/ConnectedListUtils.js';
import { Connection } from '@prisma/client';
import { Message } from 'discord.js';

export class ConnectionService {
  private readonly hubService = new HubService();

  async getConnectionData(message: Message): Promise<ConnectionData | null> {
    const connectionHubId = await getConnectionHubId(message.channelId);
    if (!connectionHubId) return null;

    const { connection, hubConnections } = await this.getConnectionAndHubConnections(
      message.channelId,
      connectionHubId,
    );

    if (!connection?.connected || !hubConnections) return null;

    const hub = await this.hubService.fetchHub(connection.hubId);
    if (!hub) return null;

    return { connection, hubConnections, hub };
  }

  private async getConnectionAndHubConnections(
    channelId: string,
    connectionHubId: string,
  ): Promise<{ connection: Connection | null; hubConnections: Connection[] | null }> {
    let connection: Connection | null = null;
    const filteredHubConnections: Connection[] = [];
    const hubConnections = await getHubConnections(connectionHubId);

    for (const conn of hubConnections) {
      if (conn.channelId === channelId) connection = conn;
      else if (conn.connected) filteredHubConnections.push(conn);
    }

    return {
      connection,
      hubConnections: filteredHubConnections.length > 0 ? filteredHubConnections : null,
    };
  }
}
