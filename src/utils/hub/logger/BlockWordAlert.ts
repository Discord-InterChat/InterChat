import { emojis } from '#utils/Constants.js';
import HubLogManager from '#main/managers/HubLogManager.js';
import { sendLog } from '#main/utils/hub/logger/Default.js';
import { ACTION_LABELS, createRegexFromWords } from '#main/utils/moderation/blockWords.js';
import { MessageBlockList } from '@prisma/client';
import { stripIndents } from 'common-tags';
import { EmbedBuilder, Message } from 'discord.js';

const boldANSIText = (text: string) => `\u001b[1;2m${text}\u001b[0m`;

export const logBlockwordAlert = async (
  message: Message<true>,
  rule: MessageBlockList,
  matches: string[],
) => {
  const logManager = await HubLogManager.create(rule.hubId);
  if (!logManager.config.networkAlerts) return;

  const content = message.content.replace(createRegexFromWords(matches), boldANSIText);
  const embed = new EmbedBuilder()
    .setColor('Yellow')
    .setTitle(`${emojis.exclamation} Blocked Word Alert`)
    .setDescription(
      stripIndents`
        A message containing blocked words was detected:

        **Rule Triggered:** ${rule.name}
        **Author:** ${message.author.tag} (${message.author.id})
        **Server:** ${message.guild.name} (${message.guild.id})

        ### Message Content:
          \`\`\`ansi
            ${content}
          \`\`\`
      -# Actions Taken: **${rule.actions.map((a) => ACTION_LABELS[a]).join(', ')}**
    `,
    )
    .setTimestamp();

  await sendLog(message.client.cluster, logManager.config.networkAlerts.channelId, embed);
};
