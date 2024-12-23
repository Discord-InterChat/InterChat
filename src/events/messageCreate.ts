import BaseEventListener from '#main/core/BaseEventListener.js';
import { showRulesScreening } from '#main/interactions/RulesScreening.js';
import { LobbyManager } from '#main/managers/LobbyManager.js';
import { MessageProcessor } from '#main/services/MessageProcessor.js';
import Constants, { emojis } from '#main/utils/Constants.js';
import { handleError, isHumanMessage } from '#utils/Utils.js';
import { stripIndents } from 'common-tags';
import { Message } from 'discord.js';

export default class MessageCreate extends BaseEventListener<'messageCreate'> {
  readonly name = 'messageCreate';
  private readonly messageProcessor: MessageProcessor;

  constructor() {
    super();
    this.messageProcessor = new MessageProcessor();
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
            ### Hey there! I'm InterChat, a bot that connects servers together. ${emojis.clipart}
            - To get started, type \`/setup\` to set up InterChat with a hub.
            - If you're new here, read the rules by typing \`/rules\`.
            - Use the [hub browser](${Constants.Links.Website}/hubs) to find and join more cross-server communities.
            -# ***Need help?** Join our [support server](<${Constants.Links.SupportInvite}>).*
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
    const lobbyManager = new LobbyManager();
    const lobby = await lobbyManager.getLobbyByChannelId(message.channelId);

    if (lobby) await this.messageProcessor.processLobbyMessage(message, lobby);
    else await this.messageProcessor.processHubMessage(message);
  }
}
