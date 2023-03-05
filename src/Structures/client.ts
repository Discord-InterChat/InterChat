import fs from 'fs';
import logger from '../Utils/logger';
import emojis from '../Utils/JSON/emoji.json';
import project from '../../package.json';
import { Client, Collection, ActivityType, MessageCreateOptions, PermissionFlagsBits, OAuth2Scopes } from 'discord.js';
import { join } from 'path';
import { prisma } from '../Utils/db';
import * as Sentry from '@sentry/node';
export class ExtendedClient extends Client {
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

  public async start(token?: string) {
    this.loadCommands();
    this.loadEvents();

    // Error monitoring (sentry.io)
    Sentry.init({ dsn: process.env.SENTRY_DSN, tracesSampleRate: 1.0 });

    const login = await this.login(token || process.env.TOKEN);

    const permissions = [
      PermissionFlagsBits.ManageChannels,
      PermissionFlagsBits.ManageWebhooks,
      PermissionFlagsBits.ChangeNickname,
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.SendMessages,
      PermissionFlagsBits.SendMessagesInThreads,
      PermissionFlagsBits.ManageGuild,
      PermissionFlagsBits.ManageMessages,
      PermissionFlagsBits.ManageThreads,
      PermissionFlagsBits.EmbedLinks,
      PermissionFlagsBits.AttachFiles,
      PermissionFlagsBits.ReadMessageHistory,
      PermissionFlagsBits.UseExternalEmojis,
      PermissionFlagsBits.AddReactions,
      PermissionFlagsBits.ViewAuditLog,
    ];
    this.inviteLink = this.generateInvite({ scopes: [OAuth2Scopes.Bot, OAuth2Scopes.ApplicationsCommands], permissions });
    return login;
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
}
