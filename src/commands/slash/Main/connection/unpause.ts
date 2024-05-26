import { ChatInputCommandInteraction, channelMention } from 'discord.js';
import Connection from './index.js';
import { simpleEmbed } from '../../../../utils/Utils.js';
import { emojis } from '../../../../utils/Constants.js';
import { t } from '../../../../utils/Locale.js';
import { modifyConnection } from '../../../../utils/ConnectedList.js';
import db from '../../../../utils/Db.js';

export default class Unpause extends Connection {
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


    if (connected.connected) {
      await interaction.reply({
        embeds: [
          simpleEmbed(
            `${emojis.no} You are already connected to this hub. Use \`/connection pause\` to pause your connection.`,
          ),
        ],
        ephemeral: true,
      });
      return;
    }

    // reconnect the channel
    await modifyConnection({ channelId }, { connected: true });

    await interaction.reply({
      embeds: [
        simpleEmbed(
          t(
            { phrase: 'connection.unpaused', locale: interaction.user.locale },
            {
              tick_emoji: emojis.tick,
              channel: channelMention(channelId),
            },
          ),
        ),
      ],
    });
  }
}
