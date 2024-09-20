import { Pagination } from '#main/modules/Pagination.js';
import Constants, { emojis } from '#main/config/Constants.js';
import db from '#main/utils/Db.js';
import { t } from '#main/utils/Locale.js';
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

    const description = t(
      { phrase: 'hub.joined.joinedHubs', locale },
      { total: `${allFields.length}` },
    );

    if (allFields.length < 25) {
      const embed = new EmbedBuilder()
        .setFields(allFields)
        .setColor(Constants.Colors.interchatBlue)
        .setDescription(description);

      await interaction.reply({ embeds: [embed] });
    }

    // Split the fields into multiple embeds
    const paginator = new Pagination();
    allFields.forEach((field, index) => {
      // Start a new embed
      if (index % 25 === 0) {
        const embed = new EmbedBuilder()
          .addFields(field)
          .setColor(Constants.Colors.interchatBlue)
          .setDescription(description);

        paginator.addPage({ embeds: [embed] });
      }
    });

    await paginator.run(interaction);
  }
}
