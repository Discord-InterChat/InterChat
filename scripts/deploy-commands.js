import { REST, Routes } from 'discord.js';
import 'dotenv/config';

const redText = (text) => `\x1b[0;31m${text}\x1b[0m`;
const greenText = (text) => `\x1b[38;5;78m${text}\x1b[0m`;
const greyText = (text) => `\x1b[38;5;246m${text}\x1b[0m`;
const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const SUPPORT_SERVER_ID = '770256165300338709';

if (!TOKEN || !CLIENT_ID || !SUPPORT_SERVER_ID) throw new Error('Missing TOKEN, CLIENT_ID or SUPPORT_SERVER_ID.')

let loadCommandFiles;
try {
  loadCommandFiles = (await import('../build/utils/LoadCommands.js')).default;
}
catch {
  console.error(`${redText('✘')} Code is not build yet. Use \`pnpm build\` first.`)
  process.exit(0)
}

const registerAllCommands = async (staffOnly = false) => {
  // make sure CommandsMap is not empty
  const commandsMap = await loadCommandFiles();

  const rest = new REST().setToken(TOKEN);

  const commands = commandsMap
    .filter((command) => (staffOnly ? command.staffOnly : !command.staffOnly))
    .map((command) => command.data);

  const route = staffOnly
    ? Routes.applicationGuildCommands(CLIENT_ID, SUPPORT_SERVER_ID)
    : Routes.applicationCommands(CLIENT_ID);

  // register all other commands to the global application;
  const registerRes = (await rest.put(route, { body: commands }));

  const type = staffOnly ? 'private' : 'public';
  const totalRegistered =
    registerRes.length === commands.length
      ? greenText(registerRes.length)
      : redText(registerRes.length);

  console.log(
    `${greenText('✓')} Registered ${totalRegistered}${greyText('/')}${greenText(commands.length)} ${type} application commands.`,
  );
};

if (process.argv) {
  for (const arg of process.argv) {
    try {
      switch (arg) {
        case '--public':
          await registerAllCommands();
          break;
        case '--private':
          await registerAllCommands(true);
          break;
        case '--help':
          console.log('Usage: node utils/RegisterCmdCli.js [--public|--private|--help]');
          break;
        default:
          break;
      }
    }
    catch (error) {
      Logger.error(error);
    }
  }
  
  process.exit(0);
}


export default registerAllCommands;