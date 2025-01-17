import { EmbedBuilder, type Message } from 'discord.js';
import BasePrefixCommand, { type CommandData } from '#main/core/BasePrefixCommand.js';
import { HubService } from '#main/services/HubService.js';
import db from '#main/utils/Db.js';
import { isStaffOrHubMod } from '#main/utils/hub/utils.js';
import { deleteMessageFromHub } from '#main/utils/moderation/deleteMessage.js';
import {
  findOriginalMessage,
  getBroadcasts,
  getMessageIdFromStr,
  getOriginalMessage,
} from '#main/utils/network/messageUtils.js';

export default class DeleteMsgCommand extends BasePrefixCommand {
  public readonly data: CommandData = {
    name: 'deletemsg',
    description: 'Delete a message',
    category: 'Network',
    usage: 'deletemsg ` message ID or link `',
    examples: [
      'deletemsg 123456789012345678',
      'deletemsg https://discord.com/channels/123456789012345678/123456789012345678/123456789012345678',
    ],
    aliases: ['delmsg', 'dmsg', 'delete', 'del'],
    dbPermission: false,
    requiredArgs: 1,
  };

  protected async run(message: Message<true>, args: string[]): Promise<void> {
    const msgId = message.reference?.messageId ?? getMessageIdFromStr(args[0]);
    const originalMsg = msgId ? await this.getOriginalMessage(msgId) : null;

    if (!originalMsg) {
      await message.channel.send('Please provide a valid message ID or link to delete.');
      return;
    }

    const hubService = new HubService(db);
    const hub = await hubService.fetchHub(originalMsg.hubId);
    if (
      !hub || // Check if the hub exists
      !(await isStaffOrHubMod(message.author.id, hub)) || // Check if the user is a staff or hub mod
      originalMsg.authorId !== message.author.id // Only then check if the user is the author of the message
    ) {
      const embed = new EmbedBuilder()
        .setColor('Red')
        .setDescription(
          `${this.getEmoji('x_icon')} You do not have permission to use this command.`,
        );
      await message.reply({ embeds: [embed] });
      return;
    }

    const reply = await message.reply(`${this.getEmoji('loading')} Deleting message...`);

    const deleted = await deleteMessageFromHub(
      originalMsg.hubId,
      originalMsg.messageId,
      Object.values(await getBroadcasts(originalMsg.messageId, originalMsg.hubId)),
    ).catch(() => null);

    await reply.edit(
      `${this.getEmoji('delete')} Deleted messages from **${deleted?.deletedCount ?? '0'}** servers.`,
    );
  }

  private async getOriginalMessage(messageId: string) {
    const originalMsg =
      (await getOriginalMessage(messageId)) ?? (await findOriginalMessage(messageId));
    return originalMsg;
  }
}
