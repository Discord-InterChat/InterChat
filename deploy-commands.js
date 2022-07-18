const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v10');
const fs = require('fs');
const prompt = require('prompt');
const { stripIndent } = require('common-tags');
const dotenv = require('dotenv');
const logger = require('./logger');

dotenv.config();


const clientID = '798748015435055134';
const server = '969920027421732874';

const rest = new REST({ version: '9' }).setToken(process.env.TOKEN);

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

	// FIXME: Change the ID main ChatBot ID
	rest.put(Routes.applicationCommands(clientID), { body: commands })
		.then(() => {
			logger.info('Registered all application commands successfully');
		})
		.catch(console.error);
};


const deployStaffCommands = async () => {
	const commands = [];
	const StaffFiles = fs.readdirSync('./commands/Staff').filter(file => file.endsWith('.js'));

	for (const StaffFile of StaffFiles) {
		const command = require(`./commands/Staff/${StaffFile}`);
		commands.push(command.data.toJSON());
	}

	// FIXME: Change the IDs to main ChatBot ID and ChatBot HQ ID
	rest.put(Routes.applicationGuildCommands(clientID, server), { body: commands })
		.then(() => logger.info('Registered all application commands for\u001b[35m ChatBot HQ\u001b[0m successfully'))
		.catch((e) => console.error(e));
};


const deplotCustomCommands = async (args, guild) => {
	const commands = [];

	if (!args) return console.log('Provide Folder Name!');

	const commandFiles = fs.readdirSync(`./commands/${args}`).filter(file => file.endsWith('.js'));

	for (const commandFile of commandFiles) {
		const command = require(`./commands/${args}/${commandFile}`);
		commands.push(command.data.toJSON());
	}

	// FIXME: Change the IDs to main ChatBot ID and ChatBot HQ ID
	rest.put(Routes.applicationGuildCommands(clientID, guild || server), { body: commands })
		.then((cmds) => {
			cmds.forEach((e) => {
				console.log(`Registered ${e.name} successfully.`);
			});
			logger.info(`Registered all application commands for\u001b[35m ${ guild || 'ChatBot HQ' }\u001b[0m successfully`);
		})
		.catch((e) => console.error(e));
};


// create a CLI prompt for deployment
const args = process.argv[2]?.toLowerCase();
const help = stripIndent`
	Usage:
		deploy [--staff | -s]
		deploy [--custom | -c] <\u001b[30mFolderName\u001b[0m> [GuildID]
		deploy [--all | -all | --a | -a]
		deploy [--help | -help | --h | -h]
	Options:
		-h, --help    Show this help message and exit.
		-a, --all     Deploy both public and private commands.
		-s, --staff   Deploy private commands.
		-c, --custom  Deploy Commands to ChatBot HQ, or any other guild. Specify the folder you want to deploy from.`;

switch (args) {
case '--staff':
case '-s':
	deployStaffCommands();
	break;
case '--custom':
case '-c': {
	const arg2 = process.argv[3];
	const guild = process.argv[4];
	deplotCustomCommands(arg2, guild);
	break;
}
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

