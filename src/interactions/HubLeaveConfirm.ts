import { ActionRowBuilder, ButtonBuilder, type ButtonInteraction, ButtonStyle } from 'discord.js';
import { RegisterInteractionHandler } from '#main/decorators/RegisterInteractionHandler.js';
import { HubService } from '#main/services/HubService.js';
import { CustomID } from '#main/utils/CustomID.js';
import { getEmoji } from '#main/utils/EmojiUtils.js';
import { t } from '#main/utils/Locale.js';
import { logGuildLeaveToHub } from '#main/utils/hub/logger/JoinLeave.js';

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

    const { userManager } = interaction.client;
    const locale = await userManager.getUserLocale(interaction.user.id);

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

    const success = await hub.connections.delete(channelId);
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
