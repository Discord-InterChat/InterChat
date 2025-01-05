import type { Connection } from '@prisma/client';
import {
  type ChatInputCommandInteraction,
  type Client,
  EmbedBuilder,
  type Guild,
  type GuildBasedChannel,
} from 'discord.js';
import { Pagination } from '#main/modules/Pagination.js';
import Constants from '#utils/Constants.js';
import { type supportedLocaleCodes, t } from '#utils/Locale.js';
import { resolveEval } from '#utils/Utils.js';
import HubCommand from './index.js';

interface ConnectionDisplayData {
  serverName?: string;
  channelName?: string;
}

export default class Servers extends HubCommand {
  private async sendErrorMessage(
    interaction: ChatInputCommandInteraction,
    message: string,
  ): Promise<void> {
    await this.replyEmbed(interaction, message);
  }

  private async getConnectionInfoEmbed(
    locale: supportedLocaleCodes,
    connection: Connection,
    server: Guild | null,
    channel: GuildBasedChannel | null,
  ): Promise<EmbedBuilder> {
    return new EmbedBuilder()
      .setTitle(`${server?.name ?? 'Unknown Server'} \`(${connection.serverId})\``)
      .setColor(Constants.Colors.interchatBlue)
      .setDescription(
        t('hub.servers.connectionInfo', locale, {
          serverId: connection.serverId,
          channelName: `${channel?.name ?? 'Unknown Channel'}`,
          channelId: connection.channelId,
          joinedAt: `<t:${Math.round(connection.createdAt.getTime() / 1000)}:d>`,
          invite: connection.invite || 'Not Set.',
          connected: connection.connected ? 'Yes' : 'No',
        }),
      );
  }

  private async fetchConnectionDisplayData(
    client: Client,
    connection: Connection,
  ): Promise<ConnectionDisplayData | null> {
    const evalArr = await client.cluster.broadcastEval(
      async (c, ctx) => {
        const server = c.guilds.cache.get(ctx.connection.serverId);
        if (server) {
          const channel = await server.channels.fetch(ctx.connection.channelId).catch(() => null);
          return { serverName: server.name, channelName: channel?.name };
        }
        return null;
      },
      { context: { connection } },
    );

    return resolveEval(evalArr) ?? null;
  }

  private async getConnectionFieldsForPagination(
    connections: Connection[],
    client: Client,
    locale: supportedLocaleCodes,
    startIndex: number,
  ): Promise<{ name: string; value: string }[]> {
    return Promise.all(
      connections.map(async (connection, index) => {
        const displayData = await this.fetchConnectionDisplayData(client, connection);
        const value = t('hub.servers.connectionInfo', locale, {
          serverId: connection.serverId,
          channelName: `${displayData?.channelName ?? 'Unknown Channel'}`,
          channelId: connection.channelId,
          joinedAt: `<t:${Math.round(connection.createdAt.getTime() / 1000)}:d>`,
          invite: connection.invite || 'Not Set.',
          connected: connection.connected ? 'Yes' : 'No',
        });
        return {
          name: `${startIndex + index}. ${displayData?.serverName ?? 'Unknown Server'}`,
          value,
        };
      }),
    );
  }

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply();

    const hubName = interaction.options.getString('hub', true);
    const serverId = interaction.options.getString('server');
    const client = interaction.client;
    const locale = await client.userManager.getUserLocale(interaction.user.id);

    const hub = (await this.hubService.findHubsByName(hubName)).at(0);
    if (!hub) {
      return this.sendErrorMessage(
        interaction,
        t('hub.notFound', locale, { emoji: this.getEmoji('x_icon') }),
      );
    }

    if (!(await hub.isMod(interaction.user.id))) {
      return this.sendErrorMessage(
        interaction,
        t('hub.notFound_mod', locale, { emoji: this.getEmoji('x_icon') }),
      );
    }

    const connections = await hub.fetchConnections();
    if (connections.length === 0) {
      return this.sendErrorMessage(
        interaction,
        t('hub.servers.noConnections', locale, {
          emoji: this.getEmoji('x_icon'),
        }),
      );
    }

    if (serverId) {
      const connection = connections.find((con) => con.serverId === serverId);
      if (!connection) {
        return this.sendErrorMessage(
          interaction,
          t('hub.servers.notConnected', locale, {
            hub: hub.data.name,
            emoji: this.getEmoji('x_icon'),
          }),
        );
      }
      const server = await client.guilds.fetch(serverId).catch(() => null);
      const channel = await server?.channels.fetch(connection.channelId).catch(() => null);
      const embed = await this.getConnectionInfoEmbed(locale, connection, server, channel ?? null);
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    const paginator = new Pagination(client);
    const itemsPerPage = 5;
    const totalConnections = connections.length;

    for (let i = 0; i < totalConnections; i += itemsPerPage) {
      const currentConnections = connections.slice(i, i + itemsPerPage);
      const startIndex = i + 1;
      const endIndex = Math.min(i + itemsPerPage, totalConnections);

      const fields = await this.getConnectionFieldsForPagination(
        currentConnections,
        client,
        locale,
        startIndex,
      );

      paginator.addPage({
        embeds: [
          new EmbedBuilder()
            .setDescription(
              t('hub.servers.total', locale, {
                from: `${startIndex}`,
                to: `${endIndex}`,
                total: `${totalConnections}`,
              }),
            )
            .setColor(Constants.Colors.interchatBlue)
            .setFields(fields),
        ],
      });
    }

    await paginator.run(interaction);
  }
}
