import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { CustomID } from '../../utils/CustomID.js';
import { emojis } from '../../utils/Constants.js';

type extraOpts = {
  disconnectEmoji?: string;
  connectEmoji?: string;
  userId?: string;
};

/**
 * @param channelId The channel ID of the connection.
 */
export function buildConnectionButtons(
  connected: boolean | undefined,
  channelId: string,
  opts: extraOpts = {},
) {
  if (!opts?.disconnectEmoji || !opts.connectEmoji) {
    opts.disconnectEmoji = emojis.disconnect;
    opts.connectEmoji = emojis.connect;
  }

  return new ActionRowBuilder<ButtonBuilder>().addComponents([
    new ButtonBuilder()
      .setCustomId(
        new CustomID()
          .setIdentifier('connection', 'toggle')
          .addArgs(channelId)
          .addArgs(opts?.userId ?? '')
          .toString(),
      )
      .setLabel(connected ? 'Disconnect' : 'Reconnect')
      .setStyle(connected ? ButtonStyle.Danger : ButtonStyle.Success)
      .setEmoji(connected ? opts.disconnectEmoji : opts.connectEmoji),
  ]);
}
