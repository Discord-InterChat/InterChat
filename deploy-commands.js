const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v10');
const fs = require('fs');
const prompt = require('prompt');
const { stripIndent } = require('common-tags');
const dotenv = require('dotenv');
const logger = require('./logger');

dotenv.config();


const clientID = '798748015435055134';
const server = '853116027588051022';

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
		.then(() => {
			logger.info('Registered all application commands successfully');
		})
		.catch(console.error);
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
			logger.info('Registered Staff application commands for \u001b[35mChatBot HQ\u001b[0m successfully');
		})
		.catch(console.error);
};


// create a CLI prompt for deployment
const args = process.argv[2]?.toLowerCase();
const help = stripIndent`
	Usage:
		deploy [--staff | -s]
		deploy [--all | -all | --a | -a]
		deploy [--help | -help | --h | -h]
	Options:
		-h, --help    Show this help message and exit.
		-a, --all     Deploy both public and private commands.
		-s, --staff   Deploy private commands.`;

switch (args) {
case '--staff':
case '-s':
	deployStaffCommands();
	break;

case '--all':
case '-all':
case '--a':
case '-a':
	prompt.start();
	console.log('Are you sure you want to deploy all commands? This will overwrite all commands and make private commands visible to every server. (y/n)');
	prompt.get(['y/n'], (err, result) => {
		result['y/n'] === 'y' ? deployCommands() && deployStaffCommands() : console.log('\n\033[31;1;4mDeployment aborted.\033[0m');
	});
	break;
case '--help':
case '-help':
case '--h':
case '-h':
	console.log(help);
	break;

case undefined:
	deployCommands();
	break;

default:
	console.log('Invalid argument provided. Please use \u001B[40;5;31mdeploy --help\u001B[0m for more information.');
}

