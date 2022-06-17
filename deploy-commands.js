#!/usr/bin/env node
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const fs = require('fs');
const dotenv = require('dotenv');
const logger = require('./logger');
dotenv.config();

const rest = new REST({ version: '9' }).setToken(process.env.TOKEN);

const commands = [];

const deployCommands = async () => {
	fs.readdirSync('./commands').forEach((dir) => {
		if (fs.statSync(`./commands/${dir}`).isDirectory()) {
			if (dir === 'private') { return; }
			const commandFiles = fs.readdirSync(`./commands/${dir}`).filter(file => file.endsWith('.js'));
			for (const commandFile of commandFiles) {
				const command = require(`./commands/${dir}/${commandFile}`);
				commands.push(command.data.toJSON());
			}
		}
	});

	// FIXME: Change the ID main ChatBot ID
	rest.put(Routes.applicationCommands('798748015435055134'), { body: commands })
		.then(() => {
			logger.info('Registered all application commands successfully');
		})
		.catch(console.error);
};

const deployPrivateCommands = async () => {
	const commandFiles = fs.readdirSync('./commands/private').filter(file => file.endsWith('.js'));
	for (const commandFile of commandFiles) {
		const command = require(`./commands/private/${commandFile}`);
		commands.push(command.data.toJSON());
	}

	// FIXME: Change the IDs to main ChatBot ID and ChatBot HQ ID
	rest.put(Routes.applicationGuildCommands('798748015435055134', '969920027421732874'), { body: commands })
		.then(() => logger.info('Registered all application commands for\u001b[35m ChatBot HQ\u001b[0m successfully'))
		.catch((e) => console.error(e));
};

async function commandLine() {

	const args = process.argv[2];

	switch (args) {
	case '--private':
	case '-p':
		await deployPrivateCommands();
		break;
	case '--all':
	case '-all':
	case '--a':
	case '-a':
		logger.warn('Deploying private and public commands...');
		await deployCommands();
		await deployPrivateCommands();
		break;
	case '--help':
	case '-help':
	case '--h':
	case '-h':
		console.log(`
Usage:
	node deploy-commands.js [--private | -p]
	node deploy-commands.js [--all | -all | --a | -a]
	node deploy-commands.js [--help | -help | --h | -h]
Options:
	-h, --help    Show this help message and exit.
	-a, --all     Deploy both public and private commands.
	-p, --private Deploy private commands.
		`);
		break;

	default:
		deployCommands().catch(console.error);
	}
}

if (process.argv[2]) {
	return commandLine();
}

deployCommands().catch(console.error);
