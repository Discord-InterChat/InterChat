const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v10');
const { stripIndent } = require('common-tags');
const fs = require('fs');
const logger = require('./logger');
require('dotenv').config();


const clientID = '798748015435055134';
const server = process.argv[3]?.toLowerCase() || '818348790435020810';


const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

const deployCommands = async () => {
	const commands = [];
	fs.readdirSync('./commands').forEach((dir) => {
		if (fs.statSync(`./commands/${dir}`).isDirectory()) {
			if (dir === 'Private' || dir === 'Staff' || dir === 'Testing') return;
			const commandFiles = fs.readdirSync(`./commands/${dir}`).filter(file => file.endsWith('.js'));
			for (const commandFile of commandFiles) {
				const command = require(`./commands/${dir}/${commandFile}`);
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
	fs.readdirSync('./commands').forEach((dir) => {
		if (fs.statSync(`./commands/${dir}`).isDirectory()) {
			if (dir === 'Private' || dir === 'Staff' || dir === 'Testing') {
				const commandFiles = fs.readdirSync(`./commands/${dir}`).filter(file => file.endsWith('.js'));
				for (const commandFile of commandFiles) {
					const command = require(`./commands/${dir}/${commandFile}`);
					commands.push(command.data.toJSON());
				}
			}
			else {
				return;
			}
		}
	});

	rest.put(Routes.applicationGuildCommands(clientID, server), { body: commands })
		.then(() => {
			rest.get(Routes.guild(server))
				.then(res => {return res.name;})
				.then(name => logger.info(`Registered Staff application commands for \u001b[35m${name}\u001b[0m successfully`));
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
			-s, --staff   Deploy private commands.
			[guildId] - The guild ID to deploy to.`);
	break;

case undefined:
	deployCommands();
	break;

default:
	logger.error('Invalid argument provided. Please use \u001B[40;5;31mdeploy --help\u001B[0m for more information.');
}

