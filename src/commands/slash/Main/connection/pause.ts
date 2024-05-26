import { ChatInputCommandInteraction, channelMention } from 'discord.js';
import Connection from './index.js';
import { simpleEmbed } from '../../../../utils/Utils.js';
import { emojis } from '../../../../utils/Constants.js';
import { t } from '../../../../utils/Locale.js';
import { modifyConnection } from '../../../../utils/ConnectedList.js';
import db from '../../../../utils/Db.js';

export default class Pause extends Connection {
  override async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const channelId = interaction.options.getString('channel', true);
    const connected = await db.connectedList.findFirst({ where: { channelId } });

    if (!connected) {
      await interaction.reply({
        embeds: [simpleEmbed(`${emojis.no} That channel is not connected to a hub!`)],
        ephemeral: true,
      });
      return;
    }

    if (!connected.connected) {
      await interaction.reply({
        embeds: [
          simpleEmbed(
            `${emojis.no} The connection is already paused for this channel. Use \`/connection unpause\` to continue chatting. `,
          ),
        ],
        ephemeral: true,
      });
      return;
    }

    // disconnect the channel
    await modifyConnection({ channelId }, { connected: false });

    await interaction.reply({
      embeds: [
        simpleEmbed(
          t(
            { phrase: 'connection.paused', locale: interaction.user.locale },
            {
              clock_emoji: emojis.timeout,
              channel: channelMention(channelId),
            },
          ),
        ),
      ],
    });
  }
}
