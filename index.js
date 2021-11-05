const discord = require('discord.js');
const dotenv = require('dotenv');
const fs = require('fs');
const mongoUtil = require('./mongoUtil.js');
const logger = require('./logger');

dotenv.config();

// eslint-disable-next-line no-unused-vars
mongoUtil.connect((err, mongoClient) => {
	if (err) console.log(err);
	logger.log('info', 'Connected to MongoDB');
});

const client = new discord.Client({
	intents: [
		discord.Intents.FLAGS.GUILDS,
		discord.Intents.FLAGS.GUILD_MESSAGES,
		discord.Intents.FLAGS.GUILD_MESSAGE_REACTIONS,
		discord.Intents.FLAGS.DIRECT_MESSAGES,
		discord.Intents.FLAGS.DIRECT_MESSAGE_REACTIONS,
	],
});

client.description = 'A growing discord bot which provides inter-server chat!';
client.commands = new discord.Collection();

module.exports.client = client;


fs.readdirSync('./commands').forEach((dir) => {
	if (fs.statSync(`./commands/${dir}`).isDirectory()) {
		const commandFiles = fs.readdirSync(`./commands/${dir}`).filter(file => file.endsWith('.js'));
		for (const commandFile of commandFiles) {
			const command = require(`./commands/${dir}/${commandFile}`);
			client.commands.set(command.data.name, command);
		}
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

client.login(process.env.TOKEN);