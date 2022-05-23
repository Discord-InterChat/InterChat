const discord = require('discord.js');
const dotenv = require('dotenv');
const fs = require('fs');
const mongoUtil = require('./utils.js');
const logger = require('./logger');
dotenv.config();

// eslint-disable-next-line no-unused-vars
mongoUtil.connect((err, mongoClient) => {
	if (err) console.log(err);
	logger.info('Connected to MongoDB');
});

const client = new discord.Client({ intents: [
	discord.GatewayIntentBits.Guilds,
	discord.GatewayIntentBits.GuildMessages,
	discord.GatewayIntentBits.GuildMessageReactions,
	discord.GatewayIntentBits.GuildMembers,
	discord.GatewayIntentBits.DirectMessages,
	discord.GatewayIntentBits.DirectMessageReactions,
	discord.GatewayIntentBits.MessageContent,
],
});

client.description = 'A growing discord bot which provides inter-server chat!';
client.commands = new discord.Collection();
client.version = 'v1.1.0';

module.exports.client = client;
module.exports.discord = discord;

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

process.on('uncaughtException', function(err) {
	logger.error('Excepton:', err);
});
process.on('unhandledRejection', function(err) {
	logger.error('Rejection:', err);
});

client.login(process.env.TOKEN);
