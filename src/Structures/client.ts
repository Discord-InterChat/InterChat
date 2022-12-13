import fs from 'fs';
import logger from '../Utils/logger';
import emojis from '../Utils/JSON/emoji.json';
import project from '../../package.json';
import { Client, Collection, ActivityType, EmbedBuilder, TextChannel, MessageCreateOptions } from 'discord.js';
import { join } from 'path';
import { colors, constants } from '../Utils/functions/utils';
import { prisma } from '../Utils/db';

interface ErrorLogData {
  level: 'INFO' | 'ERROR' | 'WARN';
  message: string;
  stack?: string;
  timestamp: string;

  [key: string]: unknown;
}

export class ChatBot extends Client {
  constructor() {
    super({
      intents: ['Guilds', 'GuildMessages', 'GuildMembers', 'MessageContent'],
      presence: {
        status: 'online',
        activities: [{
          name: `ChatBot v${project.version}`,
          type: ActivityType.Watching,
        }],
      },
    });

    this.commands = new Collection();
    this.commandsArray = [];
    this.description = project.description;
    this.version = project.version;
    this.emoji = emojis;
  }

  public async start() {
    this.loadCommands();
    this.loadEvents();
    this.handleErrors();

    return await this.login(process.env.TOKEN);
  }

  public async sendInNetwork(message: string | MessageCreateOptions): Promise<void> {
    const channels = await prisma.connectedList.findMany();

    channels?.forEach(async (channelEntry) => {
      const channel = await this.channels.fetch(channelEntry.channelId).catch(() => null);
      if (channel?.isTextBased()) {
        await channel.send(message).catch((err) => {
          if (!err.message.includes('Missing Access') || !err.message.includes('Missing Permissions')) return;
          logger.error(err);
        });
      }
    });
  }

  public async sendErrorToChannel(client: Client, embedTitle: string, ErrorStack: unknown, channel?: TextChannel | null) {
    const errorChannel = await client.channels.fetch(constants.channel.errorlogs);
    const errorEmbed = new EmbedBuilder()
      .setAuthor({ name: 'ChatBot Error Logs', iconURL: client.user?.avatarURL() || undefined })
      .setTitle(embedTitle)
      .setDescription('```js\n' + ErrorStack + '```')
      .setColor(colors('invisible'))
      .setTimestamp();


    return channel ? channel.send({ embeds: [errorEmbed] }) : errorChannel?.isTextBased() ? errorChannel?.send({ embeds: [errorEmbed] }) : undefined;
  }

  protected loadCommands() {
    fs.readdirSync(join(__dirname, '..', 'Commands')).forEach(async (dir: string) => {
      if (fs.statSync(join(__dirname, '..', 'Commands', dir)).isDirectory()) {
        const commandFiles = fs.readdirSync(join(__dirname, '..', 'Commands', dir)).filter((file: string) => file.endsWith('.js'));
        for (const commandFile of commandFiles) {
          const command = require(`../Commands/${dir}/${commandFile}`);

          this.commands.set(command.default.data.name, command.default);

        }

        // loading the help command
        const IgnoredDirs = ['Developer', 'Staff'];
        if (IgnoredDirs.includes(dir)) return;

        const cmds = commandFiles.map((command: string) => {
          const file = require(`../Commands/${dir}/${command}`);
          const name = file.default.data.name || 'No name';
          return `\`${name}\``;
        });

        this.commandsArray.push({
          name: dir,
          value: cmds.length === 0 ? 'No commands' : cmds.join(', '),
        });
      }
    });
  }

  protected loadEvents() {
    const eventFiles = fs.readdirSync(join(__dirname, '..', 'Events')).filter((file: string) => file.endsWith('.js'));

    for (const eventFile of eventFiles) {
      const event = require(`../Events/${eventFile}`);

      if (event.once) {
        this.once(event.default.name, (...args) => event.default.execute(...args, this));
      }
      else {
        this.on(event.default.name, (...args) => event.default.execute(...args, this));
      }
    }
  }

  protected handleErrors() {
    process.on('uncaughtException', (err) => logger.error('[Anti-Crash - Exception]:', err));
    process.on('unhandledRejection', (err) => logger.error('[Anti Crash - Rejection]:', err));
    logger.on('data', (data: ErrorLogData) => {
      if (data.level === 'ERROR' && this.isReady()) this.sendErrorToChannel(this, data.message, data.stack);
    });
  }
}
