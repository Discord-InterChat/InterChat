import HubManager from '#main/managers/HubManager.js';
import { Connection } from '@prisma/client';

export interface ConnectionData {
  connection: Connection;
  hubConnections: Connection[];
  hub: HubManager;
}
