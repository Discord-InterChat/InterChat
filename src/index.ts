import fs from 'fs';
import project from '../package.json';
import * as Sentry from '@sentry/node';
import { Client, Collection, ActivityType } from 'discord.js';
import 'dotenv/config';

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
  }

  public async start(token?: string) {
    this.loadCommands();
    this.loadEvents();

    // Error monitoring (sentry.io)
    Sentry.init({ dsn: process.env.SENTRY_DSN, tracesSampleRate: 1.0 });

    await this.login(token || process.env.TOKEN);
  }

  protected loadCommands() {
    fs.readdirSync(`${__dirname}/Commands/`).forEach(async (dir: string) => {
      if (fs.statSync(`${__dirname}/Commands/${dir}`).isDirectory()) {
        const commandFiles = fs.readdirSync(`${__dirname}/Commands/${dir}`)
          .filter((file: string) => file.endsWith('.js'));

        for (const commandFile of commandFiles) {
          const command = require(`./Commands/${dir}/${commandFile}`);

          command.default.directory = dir;
          this.commands.set(command.default.data.name, command.default);
        }
      }
    });
  }

  protected loadEvents() {
    const eventFiles = fs.readdirSync(`${__dirname}/Events`).filter((file: string) => file.endsWith('.js'));

    for (const eventFile of eventFiles) {
      const event = require(`./Events/${eventFile}`);

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
