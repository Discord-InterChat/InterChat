export interface ChatLobby {
  id: string;
  connections: ServerConnection[];
  lastActivity: number; // timestamp of last message
  activityLevel: number; // messages in last 5 minutes
}

export interface ServerConnection {
  serverId: string;
  channelId: string;
  webhookUrl: string;
  lastActivity: number;
}

export interface ChannelPreferences {
  minActivityLevel?: number; // minimum messages per 5 minutes
  maxServersInLobby?: number; // maximum servers in group (1-3)
  premium?: boolean;
  maxWaitTime?: number; // maximum time to wait for a group
  idealLobbySize?: number; // ideal number of servers in group
}


export interface QueuedChannel {
  serverId: string;
  channelId: string;
  webhookUrl: string;
  preferences: ChannelPreferences;
  timestamp: number;
  priority: number;
}

interface MatchingPool {
  high: QueuedChannel[];
  medium: QueuedChannel[];
  low: QueuedChannel[];
}

interface ServerPreferences {
  premiumStatus: boolean;
  maxServersInLobby: number;
}

interface LobbyData {
  id: string;
  servers: LobbyServer[];
  createdAt: number;
}

interface LobbyServer {
  serverId: string;
  webhookUrl: string;
  channelId: string;
  lastMessageTimestamp: number;
}

interface ServerHistory {
  serverId: string;
  recentLobbies: {
    lobbyId: string;
    timestamp: number;
  }[];
}
