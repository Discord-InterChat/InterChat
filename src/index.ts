import Logger from './utils/Logger.js';
import SuperClient from './core/Client.js';
import { eventMethods } from './decorators/GatewayEvent.js';
import ReactionUpdater from './utils/ReactionUpdater.js';
import EventManager from './managers/EventManager.js';

const client = new SuperClient();

// dum classes
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _reactionUpdater = ReactionUpdater;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _eventManager = EventManager;

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
