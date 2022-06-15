const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const fs = require('fs');
const dotenv = require('dotenv');
const logger = require('./logger');

dotenv.config();

const rest = new REST({ version: '9' }).setToken(process.env.TOKEN);

const commands = [];

fs.readdirSync('./commands/private').forEach((dir) => {
	if (fs.statSync(`./commands/private/${dir}`).isDirectory()) {
		const commandFiles = fs.readdirSync(`./commands/private/${dir}`).filter(file => file.endsWith('.js'));
		for (const commandFile of commandFiles) {
			const command = require(`./commands/private/${dir}/${commandFile}`);
			commands.push(command.data.toJSON());
		}
	}
});

rest.put(Routes.applicationGuildCommands('798748015435055134', '969920027421732874'), { body: commands })
	.then(() => logger.info('Registered all application commands for\u001b[35m ChatBot HQ\u001b[0m successfully'))
	.catch(console.error);