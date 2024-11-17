// @ts-check
import { Collection, REST, Routes } from 'discord.js';
import 'dotenv/config';

process.env.DEBUG = 'false'; // disable command loader logging

const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
const redText = (/** @type {string} */ text) => `\x1b[0;31m${text}\x1b[0m`;
const greenText = (/** @type {string} */ text) => `\x1b[38;5;78m${text}\x1b[0m`;
const greyText = (/** @type {string} */ text) => `\x1b[38;5;246m${text}\x1b[0m`;
const startSpinner = (/** @type {string} */ type, /** @type {string} */ totalCommands) => {
  let i = 0;
  return setInterval(() => {
    process.stdout.write(`\r${greyText(frames[i])} Registering ${greyText(totalCommands)} ${type} application commands...`);
    i = ++i % frames.length;
  }, 80);
}

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const SUPPORT_SERVER_ID = '770256165300338709';

if (!TOKEN || !CLIENT_ID)
  throw new Error('Missing TOKEN or CLIENT_ID.');

const commandUtils = await import('../build/utils/CommandUtils.js').catch(() => {
  throw new Error(`${redText('✘')} Code is not build yet. Run \`pnpm build\` first.`);
});

const registerAllCommands = async (staffOnly = false) => {
  // make sure CommandsMap is not empty
  const commandsMap = new Collection();
  await commandUtils.loadCommands(commandsMap, new Collection(), new Collection());

  
  const commands = commandsMap
  .filter((command) => (staffOnly ? command.staffOnly : !command.staffOnly))
  .map((command) => command.data);
  
  const type = staffOnly ? 'private' : 'public';
  const totalCommands = commands.length.toString();
  const spinner = startSpinner(type, totalCommands);

  const rest = new REST().setToken(TOKEN);
  const route = staffOnly
    ? Routes.applicationGuildCommands(CLIENT_ID, SUPPORT_SERVER_ID)
    : Routes.applicationCommands(CLIENT_ID);

  // register all other commands to the global application;
  /** @type {any} */
  const registerRes = await rest.put(route, { body: commands });

  const totalRegistered =
    registerRes.length === commands.length
      ? greenText(registerRes.length)
      : redText(registerRes.length);

  clearInterval(spinner);
  console.log(`\r${greenText('✓')} Registered ${totalRegistered}${greyText('/')}${greenText(totalCommands)} ${type} application commands.`); // Clear the spinner line and print "Done!"
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
  process.exit(0);
}
