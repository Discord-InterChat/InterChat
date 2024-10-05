import InterChatClient from './BaseClient.js';

export default abstract class Factory {
  protected readonly client: InterChatClient;

  constructor(client: InterChatClient) {
    this.client = client;
  }

  protected getClient(): InterChatClient {
    return this.client;
  }
}
