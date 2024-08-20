import BaseEventListener from '#main/core/BaseEventListener.js';
import Logger from '#main/utils/Logger.js';
import { Client } from 'discord.js';

export default class Ready extends BaseEventListener<'ready'> {
  readonly name = 'ready';
  public execute(client: Client<true>) {
    Logger.info(`Logged in as ${client.user?.tag}!`);
  }
}
