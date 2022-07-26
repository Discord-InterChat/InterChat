'use strict';
const discord = require('discord.js');
const dotenv = require('dotenv');
const fs = require('fs');
const mongoUtil = require('./utils.js');
const logger = require('./logger');
dotenv.config();

// eslint-disable-next-line no-unused-vars
mongoUtil.connect((err, mongoClient) => {
	if (err) logger.error(err);
	logger.info('Connected to MongoDB');
});


/*
Custom client class that enumerates custom variables like client.commands.
Inaccisable when accessing client through <Message>.client or <CommandInteraction>.client, so it is commented out for now.
If there is a way to re-declare discord.js and add the new variables to the Base Client, like TS (declare module 'discord.js'),
then that is the better option.

class MySuperClient extends discord.Client {
	constructor() {
		super({
			ws: { properties: { browser: 'Discord iOS' } },
			intents: [
				discord.Intents.FLAGS.GUILDS,
				discord.Intents.FLAGS.GUILD_MESSAGES,
				discord.Intents.FLAGS.GUILD_MEMBERS,
			],
		});
		this.commands = new discord.Collection();
		this.description = 'A growing discord bot which provides inter-server chat!';
		this.version = require('./package.json').version;
		this.help = [];
		this.icons = emojis.icons;
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
client.version = require('./package.json').version;
client.help = [];

fs.readdirSync('./commands').forEach((dir) => {
	if (fs.statSync(`./commands/${dir}`).isDirectory()) {
		const commandFiles = fs.readdirSync(`./commands/${dir}`).filter(file => file.endsWith('.js'));
		for (const commandFile of commandFiles) {
			const command = require(`./commands/${dir}/${commandFile}`);
			client.commands.set(command.data.name, command);
		}

		const IgnoredDirs = ['Private', 'TopGG'];
		if (IgnoredDirs.includes(dir)) return;

		const cmds = commandFiles.map((command) => {
			const file = (require(`./commands/${dir}/${command}`));

			const name = file.data.name?.replace('.js', '') || 'No name';

			return `\`${name}\``;
		});


		client.help.push({
			name: dir,
			value: cmds.length === 0 ? 'No commands' : cmds.join(', '),
		});


	}
});


const eventFiles = fs.readdirSync('./events').filter((file) => file.endsWith('.js'));

for (const eventFile of eventFiles) {
	const event = require(`./events/${eventFile}`);

	if (event.once) {
		client.once(event.name, (...args) => event.execute(...args, client));
	}
	else {
		client.on(event.name, (...args) => event.execute(...args, client));
	}
}

// use this function in /network connect when it errors
// or use it in setup.js when it errors
// TODO: Add disconnect and reconnect buttons to the setup.js page


process.on('uncaughtException', function(err) {
	logger.error('[Anti-Crash - Exception]:', err);
});
process.on('unhandledRejection', function(err) {
	logger.error('[Anti Crash - Rejection]:', err);
});

client.login(process.env.TOKEN);