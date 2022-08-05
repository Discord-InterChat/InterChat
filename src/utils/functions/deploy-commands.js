const { REST } = require('@discordjs/rest');
const { Routes } = require('discord.js');
const { stripIndent } = require('common-tags');
const { mainGuilds } = require('./utils');

const fs = require('fs');
const logger = require('../logger');
const discordIds = require('../discordIds.json');
require('dotenv').config();


const clientID = discordIds.client.beta.id; // FIXME: Change this to stable chatbot ID
const server = process.argv[3]?.toLowerCase() || mainGuilds.cbhq;
const IgnoredDirs = ['Developer', 'TopGG', 'Staff'];

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

const deployCommands = async () => {
	const commands = [];
	fs.readdirSync('src/commands').forEach((dir) => {
		if (fs.statSync(`src/commands/${dir}`).isDirectory()) {
			if (IgnoredDirs.includes(dir)) return;
			const commandFiles = fs.readdirSync(`src/commands/${dir}`).filter(file => file.endsWith('.js'));
			for (const commandFile of commandFiles) {
				const command = require(`../../Commands/${dir}/${commandFile}`);
				commands.push(command.data.toJSON());
			}
		}
	});

	rest.put(Routes.applicationCommands(clientID), { body: commands })
		.then(() => logger.info('Registered all application commands successfully'))
		.catch(logger.error);
};


const deployStaffCommands = async () => {
	const commands = [];
	fs.readdirSync('src/commands').forEach((dir) => {
		if (!IgnoredDirs.includes(dir)) return;
		if (fs.statSync(`src/commands/${dir}`).isDirectory()) {
			const commandFiles = fs.readdirSync(`src/commands/${dir}`).filter(file => file.endsWith('.js'));
			for (const commandFile of commandFiles) {
				const command = require(`../../commands/${dir}/${commandFile}`);
				commands.push(command.data.toJSON());
			}
		}
	});

	rest.put(Routes.applicationGuildCommands(clientID, server), { body: commands })
		.then(() => {
			rest.get(Routes.guild(server))
				.then(res => logger.info(`Registered Staff application commands for \u001b[35m${res.name}\u001b[0m successfully`));
		})
		.catch(logger.error);
};


// create a CLI prompt for deployment
const args = process.argv[2]?.toLowerCase();

switch (args) {
case '--staff':
case '-s':
	deployStaffCommands();
	break;

case '--help':
case '-help':
case '--h':
case '-h':
	logger.info(stripIndent`
	Deploy Commands -
		Usage:
			deploy [--staff | -s] [guildId]
			deploy [--help | -help | --h | -h] [guildId]
		Options:
			-h, --help    Show this help message and exit.
			-s, --staff   Deploy staff commands.
			[guildId] - The guild ID to deploy to.`);
	break;

case undefined:
	deployCommands();
	break;

default:
	logger.error('Invalid argument provided. Please use \u001B[40;5;31mdeploy --help\u001B[0m for more information.');
}

