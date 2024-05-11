import Logger from './utils/Logger.js';
import SuperClient from './core/Client.js';
import { eventMethods } from './decorators/GatewayEvent.js';

const client = new SuperClient();

// decorator events
eventMethods.forEach((methods, eventName) => {
  methods.forEach((method) => client.on(eventName, method.bind(this)));
});

client.rest.on('rateLimited', (data) => Logger.warn('Rate limited: %O', data));
client.rest.on('restDebug', (debug) => Logger.debug(debug));
client.on('debug', (debug) => {
  Logger.debug(debug);
});

client.start();
