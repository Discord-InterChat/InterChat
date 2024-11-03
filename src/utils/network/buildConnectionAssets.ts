import db from '#utils/Db.js';
import {
  EmbedBuilder,
  codeBlock,
  Snowflake,
  ActionRowBuilder,
  ChannelSelectMenuBuilder,
  ChannelType,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from 'discord.js';
import Constants, { emojis } from '#utils/Constants.js';
import { yesOrNoEmoji } from '#utils/Utils.js';
import { supportedLocaleCodes, t } from '#utils/Locale.js';
import { stripIndents } from 'common-tags';
import { CustomID } from '#utils/CustomID.js';

export const buildEditEmbed = async (
  channelId: string,
  iconURL: string | undefined,
  locale: supportedLocaleCodes = 'en',
) => {
  const networkData = await db.connectedList.findFirst({
    where: { channelId },
    include: { hub: true },
  });

  const bold = '\x1b[1m';
  const reset = '\x1b[0m';
  const invite = networkData?.invite
    ? `[\`${networkData.invite.replace('https://discord.gg/', '')}\`](${networkData.invite})`
    : 'Not Set.';

  return new EmbedBuilder()
    .setAuthor({
      name: t('connection.embed.title', locale),
      iconURL,
    })
    .setDescription(
      codeBlock(
        'ansi',
        stripIndents`
      ${bold}${t('connection.embed.fields.connected', locale)}${reset}: ${yesOrNoEmoji(networkData?.connected, '✅', '❌')}
      ${bold}${t('connection.embed.fields.compact', locale)}${reset}: ${yesOrNoEmoji(networkData?.compact, '✅', '❌')}
      ${bold}${t('connection.embed.fields.emColor', locale)}${reset}: ${networkData?.embedColor ? networkData?.embedColor : '❌'}
      ${bold}${t('connection.embed.fields.profanity', locale)}${reset}: ${yesOrNoEmoji(networkData?.profFilter, '✅', '❌')}
    `,
      ),
    )
    .addFields([
      {
        name: `${emojis.globe_icon} ${t('connection.embed.fields.hub', locale)}`,
        value: `${networkData?.hub?.name}`,
        inline: true,
      },
      {
        name: `${emojis.chat_icon} ${t('connection.embed.fields.channel', locale)}`,
        value: `<#${channelId}>`,
        inline: true,
      },
      {
        name: `${emojis.add_icon} ${t('connection.embed.fields.invite', locale)}`,
        value: invite,
        inline: true,
      },
    ])
    .setColor(Constants.Colors.invisible)
    .setFooter({ text: t('connection.embed.footer', locale) });
};

export const buildEditSelect = (
  channelId: Snowflake,
  userIdFilter: Snowflake,
  locale: supportedLocaleCodes = 'en',
) =>
  new ActionRowBuilder<StringSelectMenuBuilder>().addComponents([
    new StringSelectMenuBuilder()
      .setCustomId(
        new CustomID()
          .setIdentifier('connection', 'settings')
          .addArgs(channelId)
          .addArgs(userIdFilter)
          .toString(),
      )
      .setPlaceholder(t('connection.selects.placeholder', locale))
      .addOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel('Compact')
          .setEmoji(emojis.clipart)
          .setDescription('Disable embeds in the network to fit more messages.')
          .setValue('compact'),
        new StringSelectMenuOptionBuilder()
          .setLabel('Profanity Filter')
          .setEmoji('🤬')
          .setDescription('Toggle swear word censoring for this server.')
          .setValue('profanity'),
        new StringSelectMenuOptionBuilder()
          .setLabel('Invite Link')
          .setEmoji(emojis.members)
          .setDescription('Set an invite for network users to join your server easily!')
          .setValue('invite'),
        new StringSelectMenuOptionBuilder()
          .setLabel('Embed Color')
          .setEmoji('🎨')
          .setDescription('Set the color of embeds sent by this server.')
          .setValue('embed_color'),
      ),
  ]);

export const buildChannelSelect = (channelId: Snowflake, userIdFilter: Snowflake) =>
  new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
    new ChannelSelectMenuBuilder()
      .setCustomId(
        new CustomID()
          .setIdentifier('connection', 'change_channel')
          .addArgs(channelId)
          .addArgs(userIdFilter)
          .toString(),
      )
      .setChannelTypes(ChannelType.GuildText, ChannelType.PublicThread, ChannelType.PrivateThread)
      .setPlaceholder('💬 Want to change channels? Click me!'),
  );
