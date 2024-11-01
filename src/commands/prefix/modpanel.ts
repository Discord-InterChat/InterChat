import BasePrefixCommand, { CommandData } from '#main/core/BasePrefixCommand.js';
import { fetchHub, isStaffOrHubMod } from '#main/utils/hub/utils.js';
import modActionsPanel from '#main/utils/moderation/modActions/modActionsPanel.js';
import {
  findOriginalMessage,
  getMessageIdFromStr,
  getOriginalMessage,
} from '#main/utils/network/messageUtils.js';
import { Message } from 'discord.js';

export default class BlacklistPrefixCommand extends BasePrefixCommand {
  public readonly data: CommandData = {
    name: 'modpanel',
    description: 'Blacklist a user or server from using the bot',
    category: 'Moderation',
    usage: 'blacklist ` user ID or server ID `',
    examples: [
      'blacklist 123456789012345678',
      'blacklist 123456789012345678',
      '> Reply to a message with `blacklist` to blacklist the user who sent the message',
    ],
    aliases: ['bl', 'modactions', 'modpanel', 'mod', 'ban'],
    dbPermission: false,
    totalArgs: 1,
  };

  protected async run(message: Message<true>, args: string[]) {
    const msgId = message.reference?.messageId ?? getMessageIdFromStr(args[0]);
    const originalMessage = msgId ? await this.getOriginalMessage(msgId) : null;

    if (!originalMessage) {
      await message.channel.send('Please provide a valid message ID or link.');
      return;
    }

    const hub = await fetchHub(originalMessage.hubId);
    if (!hub || !isStaffOrHubMod(message.author.id, hub)) {
      await message.channel.send('You do not have permission to use this command.');
      return;
    }

    const modPanel = await modActionsPanel.buildMessage(message, originalMessage);
    await message.reply({ embeds: [modPanel.embed], components: modPanel.buttons });
  }
  private async getOriginalMessage(messageId: string) {
    return (await getOriginalMessage(messageId)) ?? (await findOriginalMessage(messageId)) ?? null;
  }
}
