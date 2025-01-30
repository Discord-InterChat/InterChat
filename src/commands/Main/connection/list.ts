import type { Connection, Hub } from '@prisma/client';
import { EmbedBuilder, type EmbedField } from 'discord.js';
import { Pagination } from '#src/modules/Pagination.js';
import Constants from '#utils/Constants.js';
import db from '#utils/Db.js';
import { t } from '#utils/Locale.js';
import { fetchUserLocale } from '#src/utils/Utils.js';
import type Context from '#src/core/CommandContext/Context.js';
import BaseCommand from '#src/core/BaseCommand.js';

export default class ConnectionListSubcommand extends BaseCommand {
  constructor() {
    super({
      name: 'list',
      description: '📜 List all hubs you have joined/are connected to in this server.',
      types: { prefix: true, slash: true },
    });
  }
  async execute(ctx: Context): Promise<void> {
    const connections = await db.connection.findMany({
      where: { serverId: ctx.guild?.id },
      include: { hub: true },
    });

    const locale = await fetchUserLocale(ctx.user.id);
    if (connections.length === 0) {
      await ctx.reply(
        t('hub.joined.noJoinedHubs', locale, {
          emoji: ctx.getEmoji('x_icon'),
        }),
      );
      return;
    }

    const description = t('hub.joined.joinedHubs', locale, {
      total: `${connections.length}`,
    });

    const emojis = {
      connect: ctx.getEmoji('connect'),
      disconnect: ctx.getEmoji('disconnect'),
    };

    if (connections.length <= 25) {
      const embed = this.getEmbed(
        connections.map((connection) => this.getField(connection, emojis)),
        description,
      );
      await ctx.reply({ embeds: [embed] });
      return;
    }

    const pages = this.createPaginatedEmbeds(connections, description, emojis);

    new Pagination(ctx.client).addPages(pages).run(ctx);
  }

  private createPaginatedEmbeds(
    connections: (Connection & { hub: Hub | null })[],
    description: string,
    emojis: { connect: string; disconnect: string },
    fieldsPerPage = 25,
  ) {
    const totalPages = Math.ceil(connections.length / fieldsPerPage);

    const pages = Array.from({ length: totalPages }, (_, pageIndex) => {
      const startIndex = pageIndex * fieldsPerPage;
      const fields = connections
        .slice(startIndex, startIndex + fieldsPerPage)
        .map((connection) => this.getField(connection, emojis));

      return { embeds: [this.getEmbed(fields, description)] };
    });

    return pages;
  }

  private getField(
    connection: Connection & { hub: Hub | null },
    emojis: { connect: string; disconnect: string },
  ) {
    return {
      name: `${connection.hub?.name} ${connection.connected ? emojis.connect : emojis.disconnect}`,
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
