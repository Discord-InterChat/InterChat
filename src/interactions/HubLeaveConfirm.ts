import { ActionRowBuilder, ButtonBuilder, type ButtonInteraction, ButtonStyle } from 'discord.js';
import { RegisterInteractionHandler } from '#src/decorators/RegisterInteractionHandler.js';
import { HubService } from '#src/services/HubService.js';
import { CustomID } from '#src/utils/CustomID.js';
import { getEmoji } from '#src/utils/EmojiUtils.js';
import { t } from '#src/utils/Locale.js';
import { fetchUserLocale } from '#src/utils/Utils.js';
import { logGuildLeaveToHub } from '#src/utils/hub/logger/JoinLeave.js';

export const hubLeaveConfirmButtons = (channelId: string, hubId: string) =>
  new ActionRowBuilder<ButtonBuilder>().addComponents([
    new ButtonBuilder()
      .setCustomId(new CustomID('hub_leave:yes', [channelId, hubId]).toString())
      .setLabel('Yes')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(new CustomID('hub_leave:no', [channelId, hubId]).toString())
      .setLabel('No')
      .setStyle(ButtonStyle.Danger),
  ]);

export default class ModActionsButton {
  private readonly hubService = new HubService();

  @RegisterInteractionHandler('hub_leave')
  async handler(interaction: ButtonInteraction): Promise<void> {
    const customId = CustomID.parseCustomId(interaction.customId);
    const [channelId, hubId] = customId.args;

    if (customId.suffix === 'no') {
      await interaction.deferUpdate();
      await interaction.deleteReply();
      return;
    }

    const locale = await fetchUserLocale(interaction.user.id);

    const hub = await this.hubService.fetchHub(hubId);
    if (!hub) {
      await interaction.update({
        content: t('hub.leave.noHub', locale, {
          emoji: getEmoji('x_icon', interaction.client),
        }),
        embeds: [],
        components: [],
      });
      return;
    }

    const success = await hub.connections.deleteConnection(channelId);
    if (!success) {
      await interaction.update({
        content: t('hub.leave.noHub', locale, {
          emoji: getEmoji('x_icon', interaction.client),
        }),
        embeds: [],
        components: [],
      });
    }

    await interaction.update({
      content: t('hub.leave.success', locale, {
        channel: `<#${channelId}>`,
        emoji: getEmoji('tick_icon', interaction.client),
      }),
      embeds: [],
      components: [],
    });

    // log server leave
    if (interaction.guild) {
      await logGuildLeaveToHub(hubId, interaction.guild);
    }
  }
}
