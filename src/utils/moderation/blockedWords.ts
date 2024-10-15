import { emojis, numberEmojis } from '#main/config/Constants.js';
import { CustomID } from '#utils/CustomID.js';
import { InfoEmbed } from '#utils/EmbedUtils.js';
import { MessageBlockList } from '@prisma/client';
import { stripIndents } from 'common-tags';
import {
  codeBlock,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';

export function createRegexFromWords(words: string | string[]) {
  if (Array.isArray(words)) return createRegexFromWords(words.join(','));

  const formattedWords = words.split(',').map((w) => `\\b${w}\\b`);
  return new RegExp(formattedWords.join('|'), 'gi');
}

export const sanitizeWords = (words: string) =>
  words
    // Escape special regex characters, except '*' and ','
    .replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')
    // Replace '*' with '.*' for wildcards
    .replace(/\\\*/g, '.*')
    .split(',')
    .map((word) => word.trim())
    .join(',');

export const buildBlockWordsListEmbed = (rules: MessageBlockList[]) =>
  new InfoEmbed()
    .removeTitle()
    .setDescription(
      stripIndents`
      ### ${emojis.exclamation} Blocked Words
      This hub has **${rules.length}**/2 blocked word rules.
      `,
    )
    .addFields(
      rules.map(({ words, name }, index) => ({
        name: `${numberEmojis[index + 1]}: ${name}`,
        value: codeBlock(words.replace(/\.\*/g, '*')),
      })),
    )
    .setFooter({ text: 'Click the button below to add more words' });

export const buildModifyBlockedWordsBtn = (hubId: string, rules: MessageBlockList[]) =>
  new ActionRowBuilder<ButtonBuilder>().addComponents(
    rules.map(({ id, name }, index) =>
      new ButtonBuilder()
        .setCustomId(new CustomID('blockwordsButton:modify', [hubId, id]).toString())
        .setLabel(`Modify ${name}`)
        .setEmoji(numberEmojis[index + 1])
        .setStyle(ButtonStyle.Secondary),
    ),
  );

export const buildBlockWordsModal = (hubId: string, opts?: { presetRule: MessageBlockList }) => {
  const customId = new CustomID('blockwordsModal', [hubId]);
  const modal = new ModalBuilder()
    .setTitle(opts?.presetRule ? `Edit Block Rule ${opts.presetRule.name}` : 'Add Block Word Rule')
    .setCustomId(customId.toString())
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('name')
          .setStyle(TextInputStyle.Short)
          .setLabel('Rule Name')
          .setMinLength(3)
          .setMaxLength(40)
          .setRequired(true),
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('words')
          .setStyle(TextInputStyle.Paragraph)
          .setLabel(
            opts?.presetRule
              ? 'Edit words (leave empty to delete)'
              : 'Words seperated by comma (use * for wildcard)',
          )
          .setPlaceholder('word1, *word2*, *word3, word4*')
          .setMinLength(3)
          .setRequired(!opts?.presetRule),
      ),
    );

  if (opts?.presetRule) {
    modal.setCustomId(customId.addArgs(hubId, opts.presetRule.id).toString());
    modal.components[0].components[0].setValue(opts.presetRule.name);
    modal.components[1].components[0].setValue(opts.presetRule.words.replace(/\.\*/g, '*'));
  }

  return modal;
};
