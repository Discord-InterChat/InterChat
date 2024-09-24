import { Pagination } from '#main/modules/Pagination.js';
import Constants, { emojis } from '#main/config/Constants.js';
import db from '#main/utils/Db.js';
import { t } from '#main/utils/Locale.js';
import { simpleEmbed } from '#main/utils/Utils.js';
import { connectedList, hubs } from '@prisma/client';
import { ChatInputCommandInteraction, EmbedBuilder, EmbedField } from 'discord.js';
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

    const description = t(
      { phrase: 'hub.joined.joinedHubs', locale },
      { total: `${connections.length}` },
    );

    if (connections.length <= 25) {
      const embed = this.getEmbed(connections.map(this.getField), description);
      await interaction.reply({ embeds: [embed] });
      return;
    }

    const pages = this.createPaginatedEmbeds(connections, description);

    new Pagination().addPages(pages).run(interaction);
  }

  private createPaginatedEmbeds(
    connections: (connectedList & { hub: hubs | null })[],
    description: string,
    fieldsPerPage = 25,
  ) {
    const totalPages = Math.ceil(connections.length / fieldsPerPage);

    const pages = Array.from({ length: totalPages }, (_, pageIndex) => {
      const startIndex = pageIndex * fieldsPerPage;
      const fields = connections.slice(startIndex, startIndex + fieldsPerPage).map(this.getField);

      return { embeds: [this.getEmbed(fields, description)] };
    });

    return pages;
  }

  private getField(connection: connectedList & { hub: hubs | null }) {
    return {
      name: `${connection.hub?.name}`,
      value: `<#${connection.channelId}>`,
      inline: true,
    };
  }

  private getEmbed(fields: EmbedField[], description: string) {
    return new EmbedBuilder()
      .setColor(Constants.Colors.interchatBlue)
      .setDescription(description)
      .addFields(fields);
  }
}
