import './instrument.js';
import SuperClient from './core/BaseClient.js';
import Logger from './utils/Logger.js';

const client = new SuperClient();

client.rest.on('rateLimited', (data) => Logger.warn('Rate limited: %O', data));
client.rest.on('restDebug', (debug) => Logger.debug(debug));

process.on('uncaughtException', (error) => Logger.error(error));

client.start();
