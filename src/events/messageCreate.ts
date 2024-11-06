import BaseEventListener from '#main/core/BaseEventListener.js';
import { showRulesScreening } from '#main/interactions/RulesScreening.js';
import { ConnectionService } from '#main/services/ConnectionService.js';
import { MessageProcessor } from '#main/services/MessageProcessor.js';
import { isHumanMessage } from '#utils/Utils.js';
import { Message } from 'discord.js';

export default class MessageCreate extends BaseEventListener<'messageCreate'> {
  readonly name = 'messageCreate';
  private messageProcessor: MessageProcessor;
  private connectionService: ConnectionService;

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

    await this.handleChatMessage(message);
  }

  private async handlePrefixCommand(message: Message, prefix: string) {
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

  private async handleChatMessage(message: Message<true>) {
    // Handle chat group messages
    const { chatService } = message.client;
    const group = await chatService.getChannelGroup(message.channelId);

    if (group) {
      await this.messageProcessor.processGroupMessage(message, group);
      return;
    }

    // Handle hub messages
    const connectionData = await this.connectionService.getConnectionData(message);
    if (!connectionData) return;

    await this.messageProcessor.processHubMessage(message, connectionData);
  }
}
