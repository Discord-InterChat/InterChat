const discord = require('discord.js');
const dotenv = require('dotenv');
const fs = require('fs');
const logger = require('./logger');

dotenv.config();

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

fs.readdirSync('./commands').forEach((dir) => {
	if (fs.statSync(`./commands/${dir}`).isDirectory()) {
		const commandFiles = fs.readdirSync(`./commands/${dir}`).filter(file => file.endsWith('.js'));
		for (const commandFile of commandFiles) {
			const command = require(`./commands/${dir}/${commandFile}`);
			client.commands.set(command.data.name, command);
		}
	}
});

client.once('ready', () => {
	logger.info('Ready');
});

client.on('interactionCreate', async interaction => {
	if (!interaction.isCommand()) return;

	const command = client.commands.get(interaction.commandName);

	if (!command) return;

	try {
		await command.execute(interaction);
	}
	catch (error) {
		logger.error(error);
		await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
	}
});

client.login(process.env.TOKEN);