import './instrument.js';
import SuperClient from './core/BaseClient.js';
import Logger from './utils/Logger.js';
import 'dotenv/config';

const client = new SuperClient();

client.on('debug', (debug) => Logger.debug(debug));
client.rest.on('restDebug', (debug) => Logger.debug(debug));
client.rest.on('rateLimited', (data) => Logger.warn('Rate limited: %O', data));

process.on('uncaughtException', (error) => Logger.error(error));

client.start();
