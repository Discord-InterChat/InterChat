import { Hub, connectedList } from '@prisma/client';

export interface ConnectionData {
  connection: connectedList;
  hubConnections: connectedList[];
  hub: Hub & { msgBlockList: MessageBlockList[] };
}
