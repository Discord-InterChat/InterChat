import Logger from './Logger.js';
import CommandManager from '../managers/CommandManager.js';
import { REST, Routes } from 'discord.js';
import { CLIENT_ID, SUPPORT_SERVER_ID } from './Constants.js';
import { commandsMap } from '../commands/BaseCommand.js';
import 'dotenv/config';

export default async function registerAllCommands(staffOnly = false) {
  // make sure CommandsMap is not empty
  await CommandManager.loadCommandFiles();

  const rest = new REST().setToken(process.env.TOKEN as string);

  if (staffOnly) {
    const commands = commandsMap
      .filter((command) => command.staffOnly)
      .map((command) => command.data);

    // register staff commands to the main guild
    return await rest
      .put(Routes.applicationGuildCommands(CLIENT_ID, SUPPORT_SERVER_ID), { body: commands })
      .then(() => Logger.info('Registered all staff application commands.'));
  }
  else {
    const commands = commandsMap
      .filter((command) => !command.staffOnly)
      .map((command) => command.data);

    // register all other commands to the global application;
    return await rest
      .put(Routes.applicationCommands(CLIENT_ID), { body: commands })
      .then(() => Logger.info('Registered all public application commands.'));
  }
}

process.argv.forEach((arg) => {
  if (arg === '--public') {
    registerAllCommands().then(() => process.exit(0));
  }
  else if (arg === '--private') {
    registerAllCommands(true).then(() => process.exit(0));
  }
  else if (arg === '--help') {
    Logger.info('Usage: node utils/RegisterCmdCli.js [--public|--private|--help]');
    process.exit(0);
  }
  else {
    return;
  }
});
