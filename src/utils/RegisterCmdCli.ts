import Logger from './Logger.js';
import loadCommandFiles from './LoadCommands.js';
import { REST, Routes } from 'discord.js';
import { CLIENT_ID, SUPPORT_SERVER_ID } from './Constants.js';
import { commandsMap } from '../core/BaseCommand.js';
import 'dotenv/config';

const greyText = (text: unknown) => `\x1b[38;5;246m${text}\x1b[0m`;
const greenText = (text: unknown) => `\x1b[38;5;78m${text}\x1b[0m`;

const registerAllCommands = async (staffOnly = false) => {
  // make sure CommandsMap is not empty
  await loadCommandFiles();

  const rest = new REST().setToken(process.env.TOKEN as string);

  const commands = commandsMap
    .filter((command) => (staffOnly ? command.staffOnly : !command.staffOnly))
    .map((command) => command.data);

  const route = staffOnly
    ? Routes.applicationGuildCommands(CLIENT_ID, SUPPORT_SERVER_ID)
    : Routes.applicationCommands(CLIENT_ID);

  // register all other commands to the global application;
  const registerRes = (await rest.put(route, { body: commands })) as object[];

  const type = staffOnly ? 'private' : 'public';
  const totalRegistered = registerRes.length === commands.length ? greenText(registerRes.length) : greyText(registerRes.length);
  Logger.info(`Registered ${totalRegistered}${greyText('/')}${greenText(commands.length)} ${type} application commands.`);
};

process.argv.forEach(async (arg) => {
  try {
    switch (arg) {
      case '--public':
        await registerAllCommands();
        break;
      case '--private':
        await registerAllCommands(true);
        break;
      case '--help':
        Logger.info('Usage: node utils/RegisterCmdCli.js [--public|--private|--help]');
        break;
      default:
        break;
    }
  }
  catch (error) {
    Logger.error(error);
  }
});

export default registerAllCommands;
