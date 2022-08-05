'use strict';
const discord = require('discord.js');
const mongoUtil = require('./utils/functions/utils');
const Levels = require('discord-xp');
const logger = require('./utils/logger');
const { loadCommands } = require('./handlers/handleCommands.js');
const { loadEvents } = require('./handlers/handleEvents.js');

Levels.setURL(process.env.MONGODB_URI); // FIXME: Change this to your MongoDB Atlas URL
require('dotenv').config();

mongoUtil.connect((err, mongoClient) => {
	if (err) logger.error(err);
	logger.info('Connected to MongoDB');
});

/*
Custom client class that enumerates custom variables like client.commands.
Inaccisable when accessing client through <Message>.client or <CommandInteraction>.client, so it is commented out for now.
If there is a way to re-declare discord.js and add the new variables to the Base Client, like TS (declare module 'discord.js'),
then that is the better option.
*/
/* class MySuperClient extends discord.Client {
	constructor() {
		super({
			ws: { properties: { browser: 'Discord iOS' } },
			intents: [
				discord.GatewayIntentBits.Guilds,
				discord.GatewayIntentBits.GuildMessages,
				discord.GatewayIntentBits.GuildMembers,
				discord.GatewayIntentBits.MessageContent,
			],
		});
		this.commands = new discord.Collection();
		this.description = 'A growing discord bot which provides inter-server chat!';
		this.version = require('./package.json').version;
		this.help = [];
		this.icons = emoji.icons;
	}
} */

const client = new discord.Client({
	intents: [
		discord.GatewayIntentBits.Guilds,
		discord.GatewayIntentBits.GuildMessages,
		discord.GatewayIntentBits.GuildMembers,
		discord.GatewayIntentBits.MessageContent,
	],
});

client.commands = new discord.Collection();
client.description = 'A growing discord bot which provides inter-server chat!';
client.version = require('../package.json').version;
client.help = [];

loadCommands(client);
loadEvents(client);

// TODO: Add disconnect and reconnect buttons to the setup.js page

process.on('uncaughtException', (err) => {
	logger.error('[Anti-Crash - Exception]:', err);
});
process.on('unhandledRejection', (err) => {
	logger.error('[Anti Crash - Rejection]:', err);
});

client.login(process.env.TOKEN);
