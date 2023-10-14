import db from './utils/Db.js';
import SuperClient from './SuperClient.js';
import CommandManager from './structures/CommandManager.js';
import { NetworkMessage } from './structures/NetworkManager.js';

class InterChat extends SuperClient {
  public constructor() {
    super();

    this.on('ready', () => {
      // initialize the client
      this.init();

      // load commands
      CommandManager.loadCommandFiles();

      this.logger.info(
        `Logged in as ${this.user?.tag}! Cached ${this.guilds.cache.size} guilds on Cluster ${this.cluster?.id}.`,
      );
    });

    // delete guild from database
    this.on('guildDelete', async (guild) => {
      this.logger.info(`Left ${guild.name} (${guild.id})`);
      await db.connectedList.deleteMany({ where: { serverId: guild.id } });
    });

    // handle slash/ctx commands
    this.on('interactionCreate', (interaction) => this.getCommandManager().handleInteraction(interaction));

    // handle network reactions
    this.on('messageReactionAdd', (reaction, user) => this.getReactionUpdater().listenForReactions(reaction, user));

    // handle network messages
    this.on('messageCreate', async (message) => {
      if (message.author.bot || message.system || message.webhookId) return;

      this.getNetworkManager().handleNetworkMessage(message as NetworkMessage);
    });

  }
}

const client = new InterChat();

client.login(process.env.TOKEN);
