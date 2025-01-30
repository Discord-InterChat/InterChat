import type { BlockWord } from '@prisma/client';
import { stripIndents } from 'common-tags';
import { EmbedBuilder, type Message } from 'discord.js';
import HubLogManager from '#src/managers/HubLogManager.js';
import { getEmoji } from '#src/utils/EmojiUtils.js';
import { sendLog } from '#src/utils/hub/logger/Default.js';
import { ACTION_LABELS, createRegexFromWords } from '#src/utils/moderation/blockWords.js';

const boldANSIText = (text: string) => `\u001b[1;2m${text}\u001b[0m`;

export const logBlockwordAlert = async (
  message: Message<true>,
  rule: BlockWord,
  matches: string[],
) => {
  const logManager = await HubLogManager.create(rule.hubId);
  if (!logManager.config.networkAlerts) return;

  const content = message.content.replace(createRegexFromWords(matches), boldANSIText);
  const embed = new EmbedBuilder()
    .setColor('Yellow')
    .setTitle(`${getEmoji('exclamation', message.client)} Blocked Word Alert`)
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

  const { networkAlerts: config } = logManager.config;

  await sendLog(message.client.cluster, config.channelId, embed, {
    roleMentionIds: config.roleId ? [config.roleId] : undefined,
  });
};
