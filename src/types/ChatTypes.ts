export interface ChatGroup {
  id: string;
  connections: {
    channelId: string;
    // Add other relevant fields
  }[];
}
