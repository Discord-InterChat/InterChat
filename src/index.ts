'use strict';
import discord from 'discord.js';
import express from 'express';
import Levels from 'discord-xp';
import mongoUtil from './Utils/functions/utils';
import logger from './Utils/logger';
import packagejson from '../package.json';
import 'dotenv/config';
import { loadCommands } from './Handlers/handleCommands';
import { loadEvents } from './Handlers/handleEvents';

Levels.setURL(process.env.MONGODB_URI as string);
const app = express();
const port = process.env.PORT || 8080;

mongoUtil.connect((err) => {
	if (err) logger.error(err);
	logger.info('Connected to MongoDB');
});

const client = new discord.Client({
	intents: ['Guilds', 'GuildMessages', 'GuildMembers', 'MessageContent'],
	presence: {
		status: 'online',
		activities: [{
			name: 'the Chat Network',
			type: discord.ActivityType.Watching,
		}],
	},
});

client.commands = new discord.Collection();
client.description = packagejson.description;
client.version = packagejson.version;
client.help = [];

loadCommands(client);
loadEvents(client);

process.on('uncaughtException', (err) => {
	logger.error('[Anti-Crash - Exception]:', err);
});
process.on('unhandledRejection', (err) => {
	logger.error('[Anti Crash - Rejection]:', err);
});

client.on('debug', console.log);

client.login(process.env.TOKEN);
app.listen(port, () => logger.info(`Express app listening on port ${port}`));
app.get('/', (_req, res) => res.send('Acknowledged'));