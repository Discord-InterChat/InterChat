import { RegisterInteractionHandler } from '#main/decorators/RegisterInteractionHandler.js';
import { HubService } from '#main/services/HubService.js';
import { emojis } from '#main/utils/Constants.js';
import { CustomID } from '#main/utils/CustomID.js';
import { logGuildLeaveToHub } from '#main/utils/hub/logger/JoinLeave.js';
import { t } from '#main/utils/Locale.js';
import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle } from 'discord.js';

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
        content: t('hub.leave.noHub', locale, { emoji: emojis.no }),
        embeds: [],
        components: [],
      });
      return;
    }

    const success = await hub.connections.delete(channelId);
    if (!success) {
      await interaction.update({
        content: t('hub.leave.noHub', locale, { emoji: emojis.no }),
        embeds: [],
        components: [],
      });
    }

    await interaction.update({
      content: t('hub.leave.success', locale, { channel: `<#${channelId}>`, emoji: emojis.yes }),
      embeds: [],
      components: [],
    });

    // log server leave
    if (interaction.guild) {
      await logGuildLeaveToHub(hubId, interaction.guild);
    }
  }
}
