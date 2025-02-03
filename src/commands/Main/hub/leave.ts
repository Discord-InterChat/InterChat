import { hubLeaveConfirmButtons } from '#src/interactions/HubLeaveConfirm.js';
import { type AutocompleteInteraction, EmbedBuilder } from 'discord.js';
import { escapeRegexChars, fetchUserLocale } from '#src/utils/Utils.js';
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

  async autocomplete(interaction: AutocompleteInteraction): Promise<void> {
    if (!interaction.inCachedGuild()) {
      await interaction.respond([]);
      return;
    }
    const focusedValue = escapeRegexChars(interaction.options.getFocused());
    const networks = await db.connection.findMany({
      where: {
        serverId: interaction.guild.id,
        channelId: focusedValue
          ? { contains: focusedValue, mode: 'insensitive' }
          : undefined,
      },
      select: { channelId: true, hub: true },
      take: 25,
    });

    const choices = await Promise.all(
      networks
        .filter((network) =>
          network.hub?.name.toLowerCase().includes(focusedValue.toLowerCase()),
        )
        .map(async (network) => {
          const channel = await interaction.guild.channels
            .fetch(network.channelId)
            .catch(() => null);
          return {
            name: `${network.hub?.name} | #${channel?.name ?? network.channelId}`,
            value: network.channelId,
          };
        }),
    );

    await interaction.respond(choices);
  }
}
