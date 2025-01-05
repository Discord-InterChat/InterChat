import { ActionRowBuilder, ButtonBuilder, type ButtonInteraction, ButtonStyle } from 'discord.js';
import { RegisterInteractionHandler } from '#main/decorators/RegisterInteractionHandler.js';
import { getEmoji } from '#main/utils/EmojiUtils.js';
import { fetchConnection, updateConnection } from '#utils/ConnectedListUtils.js';
import { CustomID } from '#utils/CustomID.js';
import { InfoEmbed } from '#utils/EmbedUtils.js';
import { t } from '#utils/Locale.js';

type extraOpts = {
  disconnectEmoji?: string;
  connectEmoji?: string;
  userId?: string;
  /** set custom prefix for customId and handle it urself, eg: `epik_reconnect`  */
  customCustomId?: string;
};

/**
 * @param channelId The channel ID of the connection.
 */
export const buildConnectionButtons = (
  connected: boolean | undefined,
  channelId: string,
  opts: extraOpts = {},
) => {
  if (!opts?.disconnectEmoji || !opts.connectEmoji) {
    opts.disconnectEmoji = '🔴';
    opts.connectEmoji = '🟢';
  }

  return new ActionRowBuilder<ButtonBuilder>().addComponents([
    new ButtonBuilder()
      .setCustomId(
        new CustomID()
          .setIdentifier(opts.customCustomId ?? 'connection', 'toggle')
          .setArgs(channelId)
          .setArgs(opts?.userId ?? '')
          .toString(),
      )
      .setLabel(connected ? 'Disconnect' : 'Reconnect')
      .setStyle(connected ? ButtonStyle.Danger : ButtonStyle.Success)
      .setEmoji(connected ? opts.disconnectEmoji : opts.connectEmoji),
  ]);
};

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
        t('connection.channelNotFound', locale, {
          emoji: getEmoji('x_icon', interaction.client),
        }),
      );

      await interaction.followUp({
        embeds: [notFoundEmbed],
        flags: ['Ephemeral'],
      });
      return;
    }

    await updateConnection({ channelId }, { connected: true });

    const embed = new InfoEmbed()
      .removeTitle()
      .setDescription(
        `### ${getEmoji('tick', interaction.client)} Connection Resumed\nConnection has been resumed. Have fun chatting!`,
      );

    await interaction.editReply({ embeds: [embed], components: [] });
  }
}
