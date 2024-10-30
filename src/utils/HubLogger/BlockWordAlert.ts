import { emojis } from '#main/config/Constants.js';
import HubLogManager from '#main/managers/HubLogManager.js';
import { sendLog } from '#main/utils/HubLogger/Default.js';
import { ACTION_LABELS } from '#main/utils/moderation/blockWords.js';
import { MessageBlockList } from '@prisma/client';
import { stripIndents } from 'common-tags';
import { EmbedBuilder, Message } from 'discord.js';

export const logBlockwordAlert = async (message: Message<true>, rule: MessageBlockList) => {
  const logManager = await HubLogManager.create(rule.hubId);
  if (!logManager.config.networkAlerts) return;

  const embed = new EmbedBuilder()
    .setColor('Yellow')
    .setTitle(`${emojis.exclamation} Blocked Word Alert`)
    .setDescription(
      stripIndents`
        A message containing blocked words was detected:
        **Rule Triggered:** ${rule.name}
        **Author:** ${message.author.tag} (${message.author.id})
        **Server:** ${message.guild.name} (${message.guild.id}) 
        **Message Content:**
      \`\`\`${message.content}\`\`\`

      -# Actions Taken: **${rule.actions.map((a) => ACTION_LABELS[a]).join(', ')}**
    `,
    )
    .setTimestamp();

  await sendLog(message.client.cluster, logManager.config.networkAlerts.channelId, embed);
};
