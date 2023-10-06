import { REST } from '@discordjs/rest';
import { RESTPostAPIApplicationCommandsJSONBody, RESTPostAPIApplicationGuildCommandsJSONBody, Routes } from 'discord.js';
import { stripIndent } from 'common-tags';
import { constants } from './utils';

import fs from 'fs';
import logger from './logger';
import 'dotenv/config';

const clientID = process.env.CLIENT_ID as string;
const server = process.argv[3]?.toLowerCase() || constants.guilds.cbhq;
const staffCommands = ['Developer', 'Staff'];
const commandsPath = 'build/Commands';

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN as string);

function deployCommands(staff = false) {
  const commands: RESTPostAPIApplicationCommandsJSONBody | RESTPostAPIApplicationGuildCommandsJSONBody[] = [];

  fs.readdirSync(commandsPath).forEach((dir) => {
    // Only proceed if dir is inside staffCommands array (for deploying only staff commands)
    if (staff && !staffCommands.includes(dir)) return;
    else if (!staff && staffCommands.includes(dir)) return;

    if (fs.statSync(`${commandsPath}/${dir}`).isDirectory()) {
      const commandFiles = fs.readdirSync(`${commandsPath}/${dir}`).filter(file => file.endsWith('.js'));

      for (const commandFile of commandFiles) {
        const command = require(`../Commands/${dir}/${commandFile}`);
        commands.push(command.default.data.toJSON());
      }
    }
  });

  rest.put(staff ? Routes.applicationGuildCommands(clientID, server) : Routes.applicationCommands(clientID), { body: commands })
    .then(() => logger.info(`Registered all ${staff ? 'public' : 'staff'} commands successfully.`))
    .catch(logger.error);
}

// parse command line args to determine which type of deploy
const args = process.argv[2]?.toLowerCase();

switch (args) {
  case undefined:
    deployCommands();
    break;

  case '--staff':
  case '-s':
    deployCommands(true);
    break;

  case '-b':
  case '--both':
    deployCommands();
    deployCommands(true);
    break;

  case '--help':
  case '-help':
  case '--h':
  case '-h':
    logger.info(stripIndent`
    Deploy Application Commands -
      Usage:
        deploy [--staff | -s] [guildId]
        deploy [--both | -b] [guildId]
        deploy [--help | -help | --h | -h]
      Options:
        -h, --help    Show this help message and exit.
        -s, --staff   Deploy staff commands.
        -b --both     Deploy both staff and normal commands.
        [guildId] - The guild ID to deploy to.`);
    break;

  default:
    logger.error('Invalid argument provided. Please use \u001B[40;5;31mdeploy --help\u001B[0m for more information.');
    break;
}
