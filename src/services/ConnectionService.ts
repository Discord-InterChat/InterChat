import type { ConnectionData } from '#types/ConnectionTypes.d.ts';
import { getConnectionHubId, getHubConnections } from '#utils/ConnectedListUtils.js';
import db from '#utils/Db.js';
import { connectedList } from '@prisma/client';
import { Message } from 'discord.js';

export class ConnectionService {
  async getConnectionData(message: Message): Promise<ConnectionData | null> {
    const connectionHubId = await getConnectionHubId(message.channelId);
    if (!connectionHubId) return null;

    const { connection, hubConnections } = await this.getConnectionAndHubConnections(
      message.channelId,
      connectionHubId,
    );

    if (!connection?.connected || !hubConnections) return null;

    const hub = await this.getHub(connection.hubId);
    if (!hub) return null;

    return { connection, hubConnections, hub };
  }

  private async getHub(hubId: string) {
    return await db.hub.findFirst({
      where: { id: hubId },
      include: { msgBlockList: true },
    });
  }

  private async getConnectionAndHubConnections(
    channelId: string,
    connectionHubId: string,
  ): Promise<{ connection: connectedList | null; hubConnections: connectedList[] | null }> {
    let connection: connectedList | null = null;
    const filteredHubConnections: connectedList[] = [];
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
