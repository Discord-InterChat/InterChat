import db from './utils/Db.js';
import SuperClient from './SuperClient.js';
import CommandHandler from './structures/CommandHandler.js';
import { NetworkMessage } from './structures/NetworkManager.js';

class InterChat extends SuperClient {
  public constructor() {
    super();

    this.on('ready', () => {
      // initialize the client
      this.init();

      // load commands
      CommandHandler.loadCommandFiles();

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
    this.on('messageReactionAdd', (reaction, user) => this.getReactionUpdater().listen(reaction, user));

    // handle network messages
    this.on('messageCreate', async (message) => {
      if (message.author.bot || message.system || message.webhookId) return;

      const isNetworkMessage = await db.connectedList.findFirst({
        where: { channelId: message.channel.id, connected: true },
        include: { hub: true },
      });

      if (!isNetworkMessage) return;

      this.getNetworkManager().handleNetworkMessage(message as NetworkMessage, isNetworkMessage);
    });

  }
}

const client = new InterChat();

client.login(process.env.TOKEN);
