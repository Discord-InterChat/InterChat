export interface ChatLobby {
  id: string;
  connections: ServerConnection[];
  lastActivity: number; // timestamp of last message
  activityLevel: number; // messages in last 5 minutes
}

export interface ServerConnection {
  serverId: string;
  channelId: string;
  lastActivity: number;
}

export interface ChannelPreferences {
  minActivityLevel?: number; // minimum messages per 5 minutes
  maxServers?: number; // maximum servers in group (1-3)
  premium?: boolean;
  maxWaitTime?: number; // maximum time to wait for a group
  idealLobbySize?: number; // ideal number of servers in group
}
