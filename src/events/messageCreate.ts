import { stripIndents } from 'common-tags';
import type { Client, Message } from 'discord.js';
import BaseEventListener from '#src/core/BaseEventListener.js';
import { showRulesScreening } from '#src/interactions/RulesScreening.js';
import { MessageProcessor } from '#src/services/MessageProcessor.js';
import Constants from '#src/utils/Constants.js';
import { fetchUserData, handleError, isHumanMessage } from '#utils/Utils.js';
import { executeCommand, resolveCommand } from '#src/utils/CommandUtils.js';

export default class MessageCreate extends BaseEventListener<'messageCreate'> {
  readonly name = 'messageCreate';
  private readonly messageProcessor: MessageProcessor;

  constructor(client: Client<true> | null) {
    super(client ?? null);
    this.messageProcessor = new MessageProcessor();
  }

  async execute(message: Message) {
    if (!message.inGuild() || !isHumanMessage(message)) return;

    if (message.content.startsWith('c!')) {
      await this.handlePrefixCommand(message);
      return;
    }
    if (
      message.content === `<@${message.client.user.id}>` ||
      message.content === `<@!${message.client.user.id}>`
    ) {
      await message.channel
        .send(
          stripIndents`
            ### Hey there! I'm InterChat, a bot that connects servers together. ${this.getEmoji('clipart')}
            - To get started, type \`/setup\` to set up InterChat with a hub.
            - If you're new here, read the rules by typing \`/rules\`.
            - Use the [hub browser](${Constants.Links.Website}/hubs) to find and join more cross-server communities.
            -# ***Need help?** Join our [support server](<${Constants.Links.SupportInvite}>).*
      `,
        )
        .catch(() => null);
    }

    await this.handleChatMessage(message).catch((e) => handleError(e, { repliable: message }));
  }

  private async handlePrefixCommand(message: Message) {
    const userData = await fetchUserData(message.author.id);
    if (!userData?.acceptedRules) return await showRulesScreening(message, userData);

    const { command, prefixArgs } = resolveCommand(message.client.commands, message);
    if (!command) return;

    await executeCommand(message, command, prefixArgs);
  }

  private async handleChatMessage(message: Message<true>) {
    await this.messageProcessor.processHubMessage(message);
  }
}
