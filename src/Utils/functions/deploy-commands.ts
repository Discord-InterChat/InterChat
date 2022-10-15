import { REST } from '@discordjs/rest';
import { Routes } from 'discord.js';
import { stripIndent } from 'common-tags';
import { constants } from './utils';

import fs from 'fs';
import logger from '../logger';
import { config } from 'dotenv';
import { join } from 'path';
config();

const clientID = constants.client.beta.id; // FIXME: Change this to stable chatbot ID
const server = process.argv[3]?.toLowerCase() || constants.mainGuilds.cbhq;
const IgnoredDirs = ['Developer', 'TopGG', 'Staff', 'Levelling']; // FIXME: Remove levelling system from here when it is fully implemented

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN as string);

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


async function deployCommands() {
	const commands: unknown[] = [];
	fs.readdirSync(join(__dirname, '..', '..', 'Commands')).forEach((dir) => {
		if (fs.statSync(join(__dirname, '..', '..', 'Commands', dir)).isDirectory()) {
			if (IgnoredDirs.includes(dir)) return;
			const commandFiles = fs.readdirSync(join(__dirname, '..', '..', 'Commands', dir)).filter(file => file.endsWith('.js'));
			for (const commandFile of commandFiles) {
				const command = require(join(__dirname, '..', '..', 'Commands', dir, commandFile));
				commands.push(command.default.data.toJSON());
			}
		}
	});

	rest.put(Routes.applicationCommands(clientID), { body: commands })
		.then(() => logger.info('Registered all application commands successfully'))
		.catch(logger.error);
}


async function deployStaffCommands() {
	const commands: any[] = [];
	fs.readdirSync(join(__dirname, '..', '..', 'Commands')).forEach((dir) => {
		if (!IgnoredDirs.includes(dir)) return;
		if (fs.statSync(join(__dirname, '..', '..', 'Commands', dir)).isDirectory()) {
			const commandFiles = fs.readdirSync(join(__dirname, '..', '..', 'Commands', dir)).filter(file => file.endsWith('.js'));
			for (const commandFile of commandFiles) {
				const command = require(join(__dirname, '..', '..', 'Commands', dir, commandFile));
				commands.push(command.default.data.toJSON());
			}
		}
	});

	rest.put(Routes.applicationGuildCommands(clientID, server), { body: commands })
		.then(() => {
			rest.get(Routes.guild(server))
				.then((res: any) => {
					return logger.info(`Registered Staff application commands for \u001b[35m${res.name}\u001b[0m successfully`);
				});
		})
		.catch(logger.error);
}