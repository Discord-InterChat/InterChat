import fs from 'fs';
import logger from './Utils/logger';
import emojis from './Utils/JSON/emoji.json';
import project from '../package.json';
import { Client, Collection, ActivityType, MessageCreateOptions } from 'discord.js';
import { join } from 'path';
import { Prisma } from '@prisma/client';
import { getDb } from './Utils/misc/utils';
import * as Sentry from '@sentry/node';

export class ExtendedClient extends Client {
  constructor() {
    super({
      intents: ['Guilds', 'GuildMessages', 'GuildMembers', 'MessageContent', 'GuildMessageReactions'],
      allowedMentions: { parse: [], repliedUser: true },
      presence: {
        status: 'online',
        activities: [{
          state: '👀 Watching over 300+ networks... /hub browse',
          type: ActivityType.Custom,
          name: 'custom',
        }],
      },
    });

    this.commands = new Collection();
    this.commandCooldowns = new Collection();
    this.reactionCooldowns = new Collection();
    this.description = project.description;
    this.version = project.version;
    this.emotes = emojis;
  }

  public async start(token?: string) {
    this.loadCommands();
    this.loadEvents();

    // Error monitoring (sentry.io)
    Sentry.init({ dsn: process.env.SENTRY_DSN, tracesSampleRate: 1.0 });

    return await this.login(token || process.env.TOKEN);
  }

  public async sendInNetwork(message: string | MessageCreateOptions, hub: Prisma.hubsWhereUniqueInput): Promise<void> {
    const channels = await getDb().connectedList.findMany({ where: { hub, connected: true } });

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
        const commandFiles = fs.readdirSync(join(__dirname, '..', 'Commands', dir))
          .filter((file: string) => file.endsWith('.js'));

        for (const commandFile of commandFiles) {
          const command = require(`../Commands/${dir}/${commandFile}`);

          command.default.directory = dir;
          this.commands.set(command.default.data.name, command.default);
        }
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

new ExtendedClient().start();