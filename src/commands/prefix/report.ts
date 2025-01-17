import BasePrefixCommand, { type CommandData } from '#main/core/BasePrefixCommand.js';
import { sendHubReport } from '#main/utils/hub/logger/Report.js';
import {
  findOriginalMessage,
  getBroadcasts,
  getMessageIdFromStr,
  getOriginalMessage,
} from '#main/utils/network/messageUtils.js';

import type { Message } from 'discord.js';
import ms from 'ms';

export default class ReportPrefixCommand extends BasePrefixCommand {
  public readonly data: CommandData = {
    name: 'report',
    description: 'Report a message',
    category: 'Utility',
    usage: 'report ` [messageId | messageLink] ` ` reason ` ',
    examples: [
      'report 123456789012345678',
      'report https://discord.com/channels/123456789012345678/123456789012345678/123456789012345678',
      'report 123456789012345678 Spamming',
    ],
    aliases: ['r'],
    requiredArgs: 1,
    cooldown: ms('30s'),
  };

  protected async run(message: Message<true>, args: string[]) {
    const msgId = message.reference?.messageId ?? getMessageIdFromStr(args[0] ?? args[1]);
    const originalMsg = msgId ? await this.getOriginalMessage(msgId) : null;
    const broadcastMsgs = originalMsg
      ? await getBroadcasts(originalMsg.messageId, originalMsg.hubId)
      : null;

    if (!broadcastMsgs || !originalMsg) {
      await message.channel.send('Please provide a valid message ID or link.');
      return;
    }

    const broadcastMsg = Object.values(broadcastMsgs).find((m) => m.messageId === msgId);
    if (!broadcastMsg) {
      await message.channel.send('Please provide a valid message ID or link.');
      return;
    }

    await sendHubReport(originalMsg.hubId, message.client, {
      userId: originalMsg.authorId,
      serverId: originalMsg.guildId,
      reason: message.reference?.messageId ? args[0] : args.slice(1).join(' '),
      reportedBy: message.author,
      evidence: {
        messageId: broadcastMsg.messageId,
        content: originalMsg.content,
      },
    });

    await message
      .react(this.getEmoji('tick'))
      .catch(() => message.reply(`${this.getEmoji('tick')} Sent the report.`).catch(() => null));
  }
  private async getOriginalMessage(messageId: string) {
    return (await getOriginalMessage(messageId)) ?? (await findOriginalMessage(messageId)) ?? null;
  }
}
