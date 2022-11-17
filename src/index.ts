import { Client, Collection, ActivityType } from 'discord.js';
import express from 'express';
import Levels from 'discord-xp';
import logger from './Utils/logger';
import emojis from './Utils/JSON/emoji.json';
import packagejson from '../package.json';
import 'dotenv/config';
import { loadCommands } from './Handlers/handleCommands';
import { loadEvents } from './Handlers/handleEvents';
import { handleErrors } from './Handlers/handleErrors';

Levels.setURL(process.env.MONGODB_URI as string || process.env.DATABASE_URL as string);
const app = express();
const port = process.env.PORT || 8080;

const client = new Client({
	intents: ['Guilds', 'GuildMessages', 'GuildMembers', 'MessageContent'],
	presence: {
		status: 'online',
		activities: [{
			name: `ChatBot v${packagejson.version}`,
			type: ActivityType.Watching,
		}],
	},
});

client.commands = new Collection();
client.description = packagejson.description;
client.version = packagejson.version;
client.emoji = emojis;
client.help = [];

loadCommands(client);
loadEvents(client);
handleErrors(client);

client.login(process.env.TOKEN);
app.listen(port, () => logger.info(`Express app listening on port ${port}`));
app.get('/', (_req, res) => res.send('Acknowledged'));
