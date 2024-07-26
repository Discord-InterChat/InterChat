import './instrument.js';
import SuperClient from './core/Client.js';
import { eventMethods } from './decorators/GatewayEvent.js';
import Logger from './utils/Logger.js';

const client = new SuperClient();

// decorator events
eventMethods.forEach((methods, eventName) => {
  methods.forEach((method) => client.on(eventName, method));
});

client.rest.on('rateLimited', (data) => Logger.warn('Rate limited: %O', data));
client.rest.on('restDebug', (debug) => Logger.debug(debug));
client.on('debug', (debug) => {
  Logger.debug(debug);
});

client.start();

process.on('uncaughtException', (error) => Logger.error(error));
