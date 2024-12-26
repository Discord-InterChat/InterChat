import { getEmoji } from '#main/utils/EmojiUtils.js';
import { numberEmojis } from '#utils/Constants.js';
import { CustomID } from '#utils/CustomID.js';
import { InfoEmbed } from '#utils/EmbedUtils.js';
import { BlockWord, BlockWordAction } from '@prisma/client';
import { stripIndents } from 'common-tags';
import {
  codeBlock,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  StringSelectMenuBuilder,
  Client,
} from 'discord.js';

export const ACTION_LABELS = {
  [BlockWordAction.BLOCK_MESSAGE]: '🚫 Block Message',
  [BlockWordAction.SEND_ALERT]: '🔔 Send Alert',
  [BlockWordAction.BLACKLIST]: '⛔ Blacklist User/Server',
} as const;

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

export const buildBlockWordListEmbed = (rules: BlockWord[], client: Client) =>
  new InfoEmbed()
    .removeTitle()
    .setDescription(
      stripIndents`
      ### ${getEmoji('exclamation', client)} Blocked Words
      This hub has **${rules.length}**/2 blocked word rules.
      `,
    )
    .addFields(
      rules.map(({ words, name }, index) => ({
        name: `${numberEmojis[index + 1]}: ${name}`,
        value: codeBlock(words.replace(/\.\*/g, '*')),
      })),
    );

export const buildBWRuleEmbed = (rule: BlockWord, client: Client) => {
  const actions = rule.actions.map((a) => ACTION_LABELS[a]).join(', ');
  return new InfoEmbed()
    .removeTitle()
    .setDescription(
      stripIndents`
          ### ${getEmoji('exclamation', client)} Editing Rule: ${rule.name}
          ${rule.words ? `**Blocked Words:**\n${codeBlock(rule.words.replace(/\.\*/g, '*'))}` : ''}
          -# Configured Actions: **${actions.length > 0 ? actions : 'None. Configure using the button below.'}**
          `,
    )
    .setFooter({ text: 'Click the button below to edit' });
};
export const buildBlockedWordsBtns = (hubId: string, ruleId: string) =>
  new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(new CustomID('blockwordsButton:configActions', [hubId, ruleId]).toString())
      .setLabel('Configure Actions')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(new CustomID('blockwordsButton:editWords', [hubId, ruleId]).toString())
      .setLabel('Edit Words')
      .setStyle(ButtonStyle.Secondary),
  );

export const buildBlockWordModal = (hubId: string, opts?: { presetRule: BlockWord }) => {
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
    modal.setCustomId(customId.setArgs(hubId, opts.presetRule.id).toString());
    modal.components[0].components[0].setValue(opts.presetRule.name);
    modal.components[1].components[0].setValue(opts.presetRule.words.replace(/\.\*/g, '*'));
  }

  return modal;
};

export const buildBlockWordActionsSelect = (
  hubId: string,
  ruleId: string,
  currentActions: BlockWordAction[],
) =>
  new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(new CustomID('blockwordsSelect:actions', [hubId, ruleId]).toString())
      .setPlaceholder('Select actions for this rule')
      .setMinValues(1)
      .setMaxValues(Object.keys(BlockWordAction).length)
      .setOptions(
        Object.entries(ACTION_LABELS).map(([value, label]) => ({
          label,
          value,
          default: currentActions.includes(value as BlockWordAction),
        })),
      ),
  );
