export interface ChatGroup {
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
  serverId?: string;
  minActivityLevel?: number; // minimum messages per 5 minutes
  maxServers?: number; // maximum servers in group (1-3)
}
