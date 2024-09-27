// @ts-check
import { REST, Routes } from 'discord.js';
import 'dotenv/config';

const redText = (text) => `\x1b[0;31m${text}\x1b[0m`;
const greenText = (text) => `\x1b[38;5;78m${text}\x1b[0m`;
const greyText = (text) => `\x1b[38;5;246m${text}\x1b[0m`;
const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const SUPPORT_SERVER_ID = '770256165300338709';

if (!TOKEN || !CLIENT_ID || !SUPPORT_SERVER_ID)
  throw new Error('Missing TOKEN, CLIENT_ID or SUPPORT_SERVER_ID.');

const commandUtils = await import('../build/utils/CommandUtls.js').catch(() => {
  console.error(`${redText('✘')} Code is not build yet. Use \`pnpm build\` first.`);
  process.exit();
});

const registerAllCommands = async (staffOnly = false) => {
  // make sure CommandsMap is not empty
  const commandsMap = await commandUtils.loadCommandFiles();

  const rest = new REST().setToken(TOKEN);

  const commands = commandsMap
    .filter((command) => (staffOnly ? command.staffOnly : !command.staffOnly))
    .map((command) => command.data);

  const route = staffOnly
    ? Routes.applicationGuildCommands(CLIENT_ID, SUPPORT_SERVER_ID)
    : Routes.applicationCommands(CLIENT_ID);

  // register all other commands to the global application;
  /** @type {any} */
  const registerRes = await rest.put(route, { body: commands });

  const type = staffOnly ? 'private' : 'public';
  const totalRegistered =
    registerRes.length === commands.length
      ? greenText(registerRes.length)
      : redText(registerRes.length);

  console.log(
    `${greenText('✓')} Registered ${totalRegistered}${greyText('/')}${greenText(commands.length)} ${type} application commands.`,
  );
};

const logHelp = () =>
  console.log(`${greenText('Usage')}: node scripts/deploy-commands.js {--public|--private|--help}`);
/**
 * @param {string[]} args
 */
const parseAndRun = async (args) => {
  for (const arg of process.argv.slice(2)) {
    if (!args.includes(arg)) continue;

    if (arg === '--help') {
      logHelp();
      break;
    }

    await registerAllCommands(arg === '--private').catch((e) => {
      console.error(`${redText('✘ Error: ')}`, e);
    });
  }
};

if (process.argv) {
  const allArgs = ['--help', '--public', '--private'];
  const slicedArgs = process.argv.slice(2);

  if (slicedArgs.length === 0) logHelp();
  else await parseAndRun(allArgs);

  process.exit();
}
