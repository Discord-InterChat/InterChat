import { REST } from '@discordjs/rest';
import { Routes } from 'discord.js';
import { stripIndent } from 'common-tags';
import { join } from 'path';
import { constants } from './utils';

import fs from 'fs';
import logger from '../logger';
import 'dotenv/config';

const clientID = process.env.CLIENT_ID as string;
const server = process.argv[3]?.toLowerCase() || constants.guilds.cbhq;
const staffCommands = ['Developer', 'Staff'];

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN as string);

function deployCommands() {
  const commands: unknown[] = [];
  const commandsPath = join(__dirname, '..', '..', 'Commands');

  fs.readdirSync(commandsPath).forEach((dir) => {
    if (!staffCommands.includes(dir) && fs.statSync(`${commandsPath}/${dir}`).isDirectory()) {
      const commandFiles = fs.readdirSync(`${commandsPath}/${dir}`).filter(file => file.endsWith('.js'));

      for (const commandFile of commandFiles) {
        const command = require(`../../Commands/${dir}/${commandFile}`);
        commands.push(command.default.data.toJSON());
      }
    }
  });

  rest.put(Routes.applicationCommands(clientID), { body: commands })
    .then(() => logger.info('Registered all application commands successfully.'))
    .catch(logger.error);
}


function deployStaffCommands() {
  const commands: unknown[] = [];
  const commandsPath = join(__dirname, '..', '..', 'Commands');

  fs.readdirSync(commandsPath).forEach((dir) => {
    if (staffCommands.includes(dir) && fs.statSync(`${commandsPath}/${dir}`).isDirectory()) {
      const commandFiles = fs.readdirSync(`${commandsPath}/${dir}`).filter(file => file.endsWith('.js'));

      for (const commandFile of commandFiles) {
        const command = require(`../../Commands/${dir}/${commandFile}`);
        commands.push(command.default.data.toJSON());
      }
    }
  });

  rest.put(Routes.applicationGuildCommands(clientID, server), { body: commands })
    .then(() => {
      rest.get(Routes.guild(server))
        .then((res: any) => logger.info(`Registered Staff application commands for \u001b[35m${res.name}\u001b[0m successfully.`));
    }).catch(logger.error);
}

// parse command line args to determine which type of deploy
const args = process.argv[2]?.toLowerCase();

switch (args) {
  case '--staff':
  case '-s':
    deployStaffCommands();
    break;

  case '-b':
  case '--both':
    deployCommands();
    deployStaffCommands();
    break;

  case undefined:
    deployCommands();
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
