import BaseEventListener from '#main/core/BaseEventListener.js';
import { showRulesScreening } from '#main/interactions/RulesScreening.js';
import { ConnectionService } from '#main/services/ConnectionService.js';
import { MessageProcessor } from '#main/services/MessageProcessor.js';
import Constants from '#main/utils/Constants.js';
import { handleError, isHumanMessage } from '#utils/Utils.js';
import { stripIndents } from 'common-tags';
import { Message } from 'discord.js';

export default class MessageCreate extends BaseEventListener<'messageCreate'> {
  readonly name = 'messageCreate';
  private readonly messageProcessor: MessageProcessor;
  private readonly connectionService: ConnectionService;

  constructor() {
    super();
    this.messageProcessor = new MessageProcessor();
    this.connectionService = new ConnectionService();
  }

  async execute(message: Message) {
    if (!message.inGuild() || !isHumanMessage(message)) return;

    if (message.content.startsWith('c!')) {
      await this.handlePrefixCommand(message, 'c!');
      return;
    }
    else if (
      message.content === `<@${message.client.user.id}>` ||
        message.content === `<@!${message.client.user.id}>`
    ) {
      await message.channel
        .send(
          stripIndents`
            ### Hey there! I'm InterChat, the cross-server chatting bot! 🎉
            - To get started, use  \`/help\` for a easy guide on how to use me.
            - If you're new here, please read the rules by typing \`/rules\`.
            - You can type \`c!connect\` to connect to a random lobby. Or use \`/hub join\` to join a cross-server community.
            -# **Need help?** Join our [support server](<${Constants.Links.SupportInvite}>).
      `,
        )
        .catch(() => null);
    }

    await this.handleChatMessage(message).catch((e) => handleError(e, message));
  }

  private async handlePrefixCommand(message: Message, prefix: string) {
    try {
      const userData = await message.client.userManager.getUser(message.author.id);
      if (!userData?.acceptedRules) return await showRulesScreening(message, userData);

      const args = message.content.slice(prefix.length).trim().split(/ +/);
      const commandName = args.shift()?.toLowerCase();

      if (!commandName) return;

      const command =
      message.client.prefixCommands.get(commandName) ||
      message.client.prefixCommands.find((cmd) => cmd.data.aliases?.includes(commandName));

      if (!command) return;

      await command.execute(message, args);
    }
    catch (e) {
      handleError(e, message);
    }
  }

  private async handleChatMessage(message: Message<true>) {
    // Handle lobby messages
    const { lobbyService } = message.client;
    const lobby = await lobbyService.getChannelLobby(message.channelId);

    if (lobby) {
      await this.messageProcessor.processLobbyMessage(message, lobby);
      return;
    }

    // Handle hub messages
    const connectionData = await this.connectionService.getConnectionData(message);
    if (!connectionData) return;

    await this.messageProcessor.processHubMessage(message, connectionData);
  }
}
