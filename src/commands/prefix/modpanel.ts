import BasePrefixCommand, { CommandData } from '#main/core/BasePrefixCommand.js';
import { buildModPanel } from '#main/interactions/ModPanel.js';
import { HubService } from '#main/services/HubService.js';
import { emojis } from '#main/utils/Constants.js';
import db from '#main/utils/Db.js';
import { isStaffOrHubMod } from '#main/utils/hub/utils.js';
import {
  findOriginalMessage,
  getMessageIdFromStr,
  getOriginalMessage,
} from '#main/utils/network/messageUtils.js';
import { EmbedBuilder, Message } from 'discord.js';

export default class BlacklistPrefixCommand extends BasePrefixCommand {
  public readonly data: CommandData = {
    name: 'modpanel',
    description: 'Blacklist a user or server from using the bot',
    category: 'Moderation',
    usage: 'modpanel ` messageId | messageLink `',
    examples: ['mp 123456789012345678', 'mod 123456789012345678'],
    aliases: ['bl', 'mp', 'moderate', 'modactions', 'modpanel', 'mod'],
    dbPermission: false,
    requiredArgs: 0,
  };

  protected async run(message: Message<true>, args: string[]) {
    const msgId = message.reference?.messageId ?? getMessageIdFromStr(args[0]);
    const originalMessage = msgId
      ? ((await this.getOriginalMessage(msgId)) ?? (await findOriginalMessage(msgId)))
      : null;

    if (!originalMessage) {
      await message.reply('Please provide a valid message ID or link.');
      return;
    }

    const hubService = new HubService(db);
    const hub = await hubService.fetchHub(originalMessage.hubId);
    if (!hub || !await isStaffOrHubMod(message.author.id, hub)) {
      const embed = new EmbedBuilder()
        .setColor('Red')
        .setDescription(`${emojis.no} You do not have permission to use this command.`);
      await message.reply({ embeds: [embed] });
      return;
    }

    const modPanel = await buildModPanel(message, originalMessage);
    await message.reply({ embeds: [modPanel.embed], components: modPanel.buttons });
  }
  private async getOriginalMessage(messageId: string) {
    return (await getOriginalMessage(messageId)) ?? (await findOriginalMessage(messageId)) ?? null;
  }
}
