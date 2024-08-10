import { colors, emojis } from '#main/utils/Constants.js';
import db from '#main/utils/Db.js';
import { t } from '#main/utils/Locale.js';
import { Pagination } from '#main/utils/Pagination.js';
import { simpleEmbed } from '#main/utils/Utils.js';
import { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import Hub from './index.js';

export default class Joined extends Hub {
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const connections = await db.connectedList.findMany({
      where: { serverId: interaction.guild?.id },
      include: { hub: true },
    });

    const { userManager } = interaction.client;
    const locale = await userManager.getUserLocale(interaction.user.id);
    if (connections.length === 0) {
      await interaction.reply({
        embeds: [
          simpleEmbed(t({ phrase: 'hub.joined.noJoinedHubs', locale }, { emoji: emojis.no })),
        ],
      });
      return;
    }

    const allFields = connections.map((con) => ({
      name: `${con.hub?.name}`,
      value: `<#${con.channelId}>`,
      inline: true,
    }));

    const paginator = new Pagination();

    if (allFields.length > 25) {
      // Split the fields into multiple embeds
      allFields.forEach((field, index) => {
        let embed;
        // Start a new embed
        if (index % 25 === 0) {
          embed = new EmbedBuilder()
            .setDescription(
              t({ phrase: 'hub.joined.joinedHubs', locale }, { total: `${allFields.length}` }),
            )
            .setColor(colors.interchatBlue);
        }

        // Add the field to the current embed
        if (embed) {
          embed.addFields(field);
          paginator.addPage({ embeds: [embed] });
        }

      });

      await paginator.run(interaction);
      return;
    }

    const embed = new EmbedBuilder()
      .setDescription(
        t({ phrase: 'hub.joined.joinedHubs', locale }, { total: `${allFields.length}` }),
      )
      .setFields(allFields)
      .setColor(colors.interchatBlue);

    await interaction.reply({ embeds: [embed] });
  }
}
