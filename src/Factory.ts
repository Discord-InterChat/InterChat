import SuperClient from './SuperClient.js';

export default abstract class Factory {
  protected readonly client: SuperClient;

  constructor(client: SuperClient) {
    this.client = client;
  }

  protected getClient(): SuperClient {
    return this.client;
  }
}
