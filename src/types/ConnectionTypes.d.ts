import type ConnectionManager from '#src/managers/ConnectionManager.js';
import type HubManager from '#src/managers/HubManager.js';

export interface ConnectionData {
  connection: ConnectionManager;
  hubConnections: ConnectionManager[];
  hub: HubManager;
}
