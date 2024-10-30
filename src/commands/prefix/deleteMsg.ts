import { emojis } from '#main/config/Constants.js';
import BasePrefixCommand, { CommandData } from '#main/core/BasePrefixCommand.js';
import { fetchHub, isStaffOrHubMod } from '#main/utils/hub/utils.js';
import { deleteMessageFromHub } from '#main/utils/moderation/deleteMessage.js';
import {
  findOriginalMessage,
  getBroadcasts,
  getMessageIdFromStr,
  getOriginalMessage,
  OriginalMessage,
} from '#main/utils/network/messageUtils.js';
import { Message } from 'discord.js';

export default class DeleteMsgCommand extends BasePrefixCommand {
  public readonly data: CommandData = {
    name: 'deletemsg',
    description: 'Delete a message',
    category: 'Network',
    usage: 'deletemsg <message ID or link>',
    examples: [
      'deletemsg 123456789012345678',
      'deletemsg https://discord.com/channels/123456789012345678/123456789012345678/123456789012345678',
    ],
    aliases: ['delmsg', 'dmsg', 'delete', 'del'],
    dbPermission: false,
  };

  public async execute(message: Message<true>, args: string[]): Promise<void> {
    const originalMsgId = message.reference?.messageId ?? getMessageIdFromStr(args[0]);
    const originalMsg = originalMsgId ? await this.getOriginalMessage(originalMsgId) : null;

    if (!originalMsg) {
      await message.channel.send('Please provide a valid message ID or link to delete.');
      return;
    }

    const hub = await fetchHub(originalMsg.hubId);
    if (!hub || !isStaffOrHubMod(message.author.id, hub)) {
      await message.channel.send('You do not have permission to use this command.');
      return;
    }

    const reply = await message.reply(`${emojis.loading} Deleting message...`);

    const deleted = await deleteMessageFromHub(
      originalMsg.hubId,
      originalMsg.messageId,
      Object.values(await getBroadcasts(originalMsg.messageId, originalMsg.hubId)),
    ).catch(() => null);

    await reply.edit(
      `${emojis.delete} Deleted messages from **${deleted?.deletedCount ?? '0'}** servers.`,
    );
  }

  private async getOriginalMessage(messageId: string) {
    const originalMsg =
      (await getOriginalMessage(messageId)) ?? (await findOriginalMessage(messageId));
    return originalMsg;
  }

  private async getOriginalMsgs(args: string[]): Promise<OriginalMessage[]> {
    const promises = args.map(async (arg) => {
      const messageId = getMessageIdFromStr(arg);
      return messageId ? await this.getOriginalMessage(messageId) : null;
    });

    const results = await Promise.all(promises);
    return results.filter((id): id is OriginalMessage => id !== null);
  }
}
