import { hubLeaveConfirmButtons } from '#main/interactions/HubLeaveConfirm.js';
import { setComponentExpiry } from '#utils/ComponentUtils.js';
import { emojis } from '#utils/Constants.js';
import db from '#utils/Db.js';
import { t } from '#utils/Locale.js';
import {
  CacheType,
  ChatInputCommandInteraction,
  EmbedBuilder,
} from 'discord.js';
import HubCommand from './index.js';

export default class Leave extends HubCommand {
  async execute(interaction: ChatInputCommandInteraction<CacheType>): Promise<void> {
    if (!interaction.inCachedGuild()) return;
    await interaction.deferReply({ ephemeral: true });

    const channelId = interaction.options.getString('hub', true);
    const isChannelConnected = await db.connection.findFirst({
      where: { channelId },
      include: { hub: true },
    });

    const { userManager } = interaction.client;
    const locale = await userManager.getUserLocale(interaction.user.id);
    if (!isChannelConnected) {
      await this.replyEmbed(interaction, t('hub.leave.noHub', locale, { emoji: emojis.no }));
      return;
    }
    else if (!interaction.member.permissions.has('ManageChannels', true)) {
      await this.replyEmbed(
        interaction,
        t('errors.missingPermissions', locale, {
          permissions: 'Manage Channels',
          emoji: emojis.no,
        }),
      );
      return;
    }

    const resetConfirmEmbed = new EmbedBuilder()
      .setDescription(
        t('hub.leave.confirm', locale, {
          channel: `<#${channelId}>`,
          hub: `${isChannelConnected.hub?.name}`,
        }),
      )
      .setColor('Red')
      .setFooter({
        text: t('hub.leave.confirmFooter', locale),
      });

    const reply = await interaction.editReply({
      embeds: [resetConfirmEmbed],
      components: [hubLeaveConfirmButtons(channelId, isChannelConnected.hubId)],
    });

    setComponentExpiry(interaction.client.getScheduler(), reply, 10_000);
  }
}
