import Hub from './index.js';
import db from '../../../../utils/Db.js';
import { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { paginate } from '../../../../utils/Pagination.js';
import { simpleEmbed } from '../../../../utils/Utils.js';
import { __ } from '../../../../utils/Locale.js';
import { colors } from '../../../../utils/Constants.js';

export default class Joined extends Hub {
  async execute(interaction: ChatInputCommandInteraction) {
    const connections = await db.connectedList.findMany({
      where: { serverId: interaction.guild?.id },
      include: { hub: true },
    });
    if (connections.length === 0) {
      return await interaction.reply({
        embeds: [
          simpleEmbed(__({ phrase: 'hub.joined.noJoinedHubs', locale: interaction.user.locale })),
        ],
      });
    }

    const allFields = connections.map((con) => ({
      name: `${con.hub?.name}`,
      value: `<#${con.channelId}>`,
      inline: true,
    }));

    if (allFields.length > 25) {
      const paginateEmbeds: EmbedBuilder[] = [];
      let currentEmbed: EmbedBuilder | undefined;

      // Split the fields into multiple embeds
      allFields.forEach((field, index) => {
        if (index % 25 === 0) {
          // Start a new embed
          currentEmbed = new EmbedBuilder()
            .setDescription(
              __(
                { phrase: 'hub.joined.joinedHubs', locale: interaction.user.locale },
                { total: `${allFields.length}` },
              ),
            )
            .setColor(colors.interchatBlue);

          paginateEmbeds.push(currentEmbed);
        }

        // Add the field to the current embed
        if (currentEmbed) {
          currentEmbed.addFields(field);
        }
      });

      paginate(interaction, paginateEmbeds);
      return;
    }

    const embed = new EmbedBuilder()
      .setDescription(
        __(
          { phrase: 'hub.joined.joinedHubs', locale: interaction.user.locale },
          { total: `${allFields.length}` },
        ),
      )
      .setFields(allFields)
      .setColor(colors.interchatBlue);

    await interaction.reply({ embeds: [embed] });
  }
}
