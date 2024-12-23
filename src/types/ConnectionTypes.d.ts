import ConnectionManager from '#main/managers/ConnectionManager.js';
import HubManager from '#main/managers/HubManager.js';

export interface ConnectionData {
  connection: ConnectionManager;
  hubConnections: ConnectionManager[];
  hub: HubManager;
}
