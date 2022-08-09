'use strict';
const app = require('express')();
const port = process.env.port || 8080;

app.listen(port, () => logger.info(`Express app listening on port ${port}`));
app.get('/', (req, res) => res.send('Welcome- wait what are you doing here???'));

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