import { hubLeaveConfirmButtons } from '#src/interactions/HubLeaveConfirm.js';
import { EmbedBuilder } from 'discord.js';
import { fetchUserLocale } from '#src/utils/Utils.js';
import db from '#utils/Db.js';
import { t } from '#utils/Locale.js';
import type Context from '#src/core/CommandContext/Context.js';
import BaseCommand from '#src/core/BaseCommand.js';
import { hubOption } from '#src/commands/Main/hub/index.js';

export default class HubLeaveSubcommand extends BaseCommand {
  constructor() {
    super({
      name: 'leave',
      description: '👋 Leave a hub from this server.',
      types: { slash: true, prefix: true },
      options: [hubOption],
    });
  }
  async execute(ctx: Context): Promise<void> {
    if (!ctx.inGuild()) return;
    await ctx.deferReply({ flags: ['Ephemeral'] });

    const channelId = ctx.options.getString('hub', true);
    const isChannelConnected = await db.connection.findFirst({
      where: { channelId },
      include: { hub: true },
    });

    const locale = await fetchUserLocale(ctx.user.id);
    if (!isChannelConnected) {
      await ctx.replyEmbed(
        t('hub.leave.noHub', locale, { emoji: ctx.getEmoji('x_icon') }),
      );
      return;
    }
    if (
      !ctx.guild?.members.cache
        .get(ctx.user.id)
        ?.permissions.has('ManageChannels')
    ) {
      await ctx.replyEmbed(
        t('errors.missingPermissions', locale, {
          permissions: 'Manage Channels',
          emoji: ctx.getEmoji('x_icon'),
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

    await ctx.editOrReply({
      embeds: [resetConfirmEmbed],
      components: [hubLeaveConfirmButtons(channelId, isChannelConnected.hubId)],
    });
  }
}
