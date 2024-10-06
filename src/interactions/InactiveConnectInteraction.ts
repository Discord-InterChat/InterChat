import { emojis } from '#main/config/Constants.js';
import { RegisterInteractionHandler } from '#main/decorators/Interaction.js';
import { fetchConnection, updateConnection } from '#main/utils/ConnectedListUtils.js';
import { CustomID } from '#main/utils/CustomID.js';
import { InfoEmbed } from '#main/utils/EmbedUtils.js';
import { t } from '#main/utils/Locale.js';
import { type ButtonInteraction } from 'discord.js';

export default class InactiveConnectInteraction {
  @RegisterInteractionHandler('inactiveConnect', 'toggle')
  async inactiveConnect(interaction: ButtonInteraction): Promise<void> {
    await interaction.deferUpdate();

    const customId = CustomID.parseCustomId(interaction.customId);
    const [channelId] = customId.args;

    const connection = await fetchConnection(channelId);
    if (!connection) {
      const locale = await interaction.client.userManager.getUserLocale(interaction.user.id);
      const notFoundEmbed = new InfoEmbed().setDescription(
        t('connection.channelNotFound', locale, { emoji: emojis.no }),
      );

      await interaction.reply({ embeds: [notFoundEmbed], ephemeral: true });
      return;
    }

    await updateConnection({ channelId }, { connected: true });

    const embed = new InfoEmbed()
      .removeTitle()
      .setDescription(
        `### ${emojis.tick} Connection Resumed\nConnection has been resumed. Have fun chatting!`,
      );

    await interaction.editReply({ embeds: [embed], components: [] });
  }
}
