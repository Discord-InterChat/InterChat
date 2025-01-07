import type { Connection, Hub } from '@prisma/client';
import { type ChatInputCommandInteraction, EmbedBuilder, type EmbedField } from 'discord.js';
import { Pagination } from '#main/modules/Pagination.js';
import Constants from '#utils/Constants.js';
import db from '#utils/Db.js';
import { t } from '#utils/Locale.js';
import ConnectionCommand from './index.js';
import { fetchUserLocale } from '#main/utils/Utils.js';

export default class List extends ConnectionCommand {
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const connections = await db.connection.findMany({
      where: { serverId: interaction.guild?.id },
      include: { hub: true },
    });

    const locale = await fetchUserLocale(interaction.user.id);
    if (connections.length === 0) {
      await interaction.reply(
        t('hub.joined.noJoinedHubs', locale, {
          emoji: this.getEmoji('x_icon'),
        }),
      );
      return;
    }

    const description = t('hub.joined.joinedHubs', locale, {
      total: `${connections.length}`,
    });

    if (connections.length <= 25) {
      const embed = this.getEmbed(connections.map(this.getField.bind(this)), description);
      await interaction.reply({ embeds: [embed] });
      return;
    }

    const pages = this.createPaginatedEmbeds(connections, description);

    new Pagination(interaction.client).addPages(pages).run(interaction);
  }

  private createPaginatedEmbeds(
    connections: (Connection & { hub: Hub | null })[],
    description: string,
    fieldsPerPage = 25,
  ) {
    const totalPages = Math.ceil(connections.length / fieldsPerPage);

    const pages = Array.from({ length: totalPages }, (_, pageIndex) => {
      const startIndex = pageIndex * fieldsPerPage;
      const fields = connections
        .slice(startIndex, startIndex + fieldsPerPage)
        .map(this.getField.bind(this));

      return { embeds: [this.getEmbed(fields, description)] };
    });

    return pages;
  }

  private getField(connection: Connection & { hub: Hub | null }) {
    return {
      name: `${connection.hub?.name} ${connection.connected ? this.getEmoji('connect') : this.getEmoji('disconnect')}`,
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
