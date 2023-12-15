import {
  ChatInputCommandInteraction,
  CacheType,
  MessageComponentInteraction,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from 'discord.js';
import db from '../../../../utils/Db.js';
import Hub from './index.js';
import { RegisterInteractionHandler } from '../../../../decorators/Interaction.js';
import { CustomID } from '../../../../utils/CustomID.js';
import { emojis } from '../../../../utils/Constants.js';
import { simpleEmbed, setComponentExpiry } from '../../../../utils/Utils.js';
import { __ } from '../../../../utils/Locale.js';

export default class Leave extends Hub {
  async execute(interaction: ChatInputCommandInteraction<CacheType>) {
    if (!interaction.inCachedGuild()) return;

    const channelId = interaction.options.getString('hub', true);
    const isChannelConnected = await db.connectedList.findFirst({
      where: { channelId },
      include: { hub: true },
    });

    if (!isChannelConnected) {
      return await interaction.reply({
        embeds: [simpleEmbed(__({ phrase: 'hub.leave.noHub', locale: interaction.user.locale }))],
        ephemeral: true,
      });
    }
    else if (!interaction.member.permissions.has('ManageChannels', true)) {
      return await interaction.reply({
        embeds: [
          simpleEmbed(
            __(
              { phrase: 'errors.missingPermissions', locale: interaction.user.locale },
              { permission: 'Manage Channels' },
            ),
          ),
        ],
        ephemeral: true,
      });
    }

    const choiceButtons = new ActionRowBuilder<ButtonBuilder>().addComponents([
      new ButtonBuilder()
        .setCustomId(new CustomID('hub_leave:yes', [channelId]).toString())
        .setLabel('Yes')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(new CustomID('hub_leave:no', [channelId]).toString())
        .setLabel('No')
        .setStyle(ButtonStyle.Danger),
    ]);

    const resetConfirmEmbed = new EmbedBuilder()
      .setDescription(
        __(
          { phrase: 'hub.leave.confirm', locale: interaction.user.locale },
          { channel: `<#${channelId}>`, hub: `${isChannelConnected.hub?.name}` },
        ),
      )
      .setColor('Red')
      .setFooter({
        text: __({ phrase: 'hub.leave.confirmFooter', locale: interaction.user.locale }),
      });

    await interaction.reply({
      embeds: [resetConfirmEmbed],
      components: [choiceButtons],
      fetchReply: true,
    });

    setComponentExpiry(interaction.client.getScheduler(), await interaction.fetchReply(), 10_000);
  }

  @RegisterInteractionHandler('hub_leave')
  async handleComponents(interaction: MessageComponentInteraction<CacheType>) {
    const customId = CustomID.parseCustomId(interaction.customId);
    const channelId = customId.args[0];

    if (customId.postfix === 'no') {
      await interaction.message.delete();
      return;
    }

    await db.connectedList.delete({ where: { channelId } });
    await interaction.update({
      content: __(
        { phrase: 'hub.leave.success', locale: interaction.user.locale },
        { channel: `<#${channelId}>`, emoji: emojis.yes },
      ),
      embeds: [],
      components: [],
    });
  }
}
