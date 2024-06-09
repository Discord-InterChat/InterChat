import './instrument.js';
import Logger from './utils/Logger.js';
import SuperClient from './core/Client.js';
import EventManager from './managers/EventManager.js';
import { eventMethods } from './decorators/GatewayEvent.js';
import { RandomComponents } from './utils/RandomComponents.js';

const client = new SuperClient();

// dum classes
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _randomComponentHandlers = RandomComponents;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _eventManager = EventManager;

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
