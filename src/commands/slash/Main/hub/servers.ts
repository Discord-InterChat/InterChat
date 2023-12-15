import { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import Hub from './index.js';
import { colors } from '../../../../utils/Constants.js';
import { paginate } from '../../../../utils/Pagination.js';
import db from '../../../../utils/Db.js';
import { simpleEmbed } from '../../../../utils/Utils.js';
import { __ } from '../../../../utils/Locale.js';

export default class Servers extends Hub {
  async execute(interaction: ChatInputCommandInteraction) {
    const hubOpt = interaction.options.getString('hub', true);
    const serverOpt = interaction.options.getString('server');
    const locale = interaction.user.locale;

    const hub = await db.hubs.findUnique({
      where: { name: hubOpt },
      include: { connections: true },
    });

    if (!hub) {
      await interaction.reply({
        embeds: [simpleEmbed(__({ phrase: 'hub.notFound', locale }))],
        ephemeral: true,
      });
      return;
    }
    else if (
      hub.ownerId !== interaction.user.id &&
      !hub.moderators.some((mod) => mod.userId === interaction.user.id)
    ) {
      await interaction.reply({
        embeds: [simpleEmbed(__({ phrase: 'hub.notFound_mod', locale }))],
        ephemeral: true,
      });
      return;
    }

    if (hub.connections.length === 0) {
      await interaction.reply({
        embeds: [simpleEmbed(__({ phrase: 'hub.servers.noConnections', locale }))],
        ephemeral: true,
      });
      return;
    }

    if (serverOpt) {
      const connection = hub.connections.find((con) => con.serverId === serverOpt);
      if (!connection) {
        return await interaction.reply({
          embeds: [simpleEmbed(__({ phrase: 'hub.servers.notConnected', locale }))],
          ephemeral: true,
        });
      }
      const server = await interaction.client.guilds.fetch(serverOpt).catch(() => null);
      const channel = await server?.channels.fetch(connection.channelId).catch(() => null);
      const embed = new EmbedBuilder()
        .setTitle(`${server?.name} \`(${connection.serverId})\``)
        .setColor(colors.interchatBlue)
        .setDescription(
          __(
            { phrase: 'hub.servers.connectionInfo', locale },
            {
              channelName: `${channel?.name}`,
              channelId: connection.channelId,
              joinedAt: `<t:${Math.round(connection.date.getTime() / 1000)}:d>`,
              invite: connection.invite ? connection.invite : 'Not Set.',
              connected: connection.connected ? 'Yes' : 'No',
            },
          ),
        );

      await interaction.reply({ embeds: [embed] });
      return;
    }

    const embeds: EmbedBuilder[] = [];
    let itemsPerPage = 5;

    for (let index = 0; index < hub.connections.length; index += 5) {
      const current = hub.connections?.slice(index, itemsPerPage);

      let j = index;
      let l = index;
      itemsPerPage += 5;

      const fields = current.map(async (connection) => {
        const evalArr = await interaction.client.cluster.broadcastEval(
          async (client, ctx) => {
            const server = client.guilds.cache.get(ctx.connection.serverId);

            if (server) {
              const channel = await server?.channels
                .fetch(ctx.connection.channelId)
                .catch(() => null);
              return { serverName: server.name, channelName: channel?.name };
            }
          },
          { context: { connection } },
        );

        const evalRes = interaction.client.resolveEval(evalArr);

        const value = __(
          { phrase: 'hub.servers.connectionInfo', locale },
          {
            total: `${hub.connections.length}`,
            channelName: `${evalRes?.channelName}`,
            channelId: connection.channelId,
            joinedAt: `<t:${Math.round(connection.date.getTime() / 1000)}:d>`,
            invite: connection.invite ? connection.invite : 'Not Set.',
            connected: connection.connected ? 'Yes' : 'No',
          },
        );

        return { name: `${++j}. ${evalRes?.serverName}`, value };
      });

      embeds.push(
        new EmbedBuilder()
          .setDescription(
            __(
              { phrase: 'hub.servers.total', locale },
              {
                from: `${++l}`,
                to: `${j}`,
                total: `${hub.connections.length}`,
              },
            ),
          )
          .setColor(0x2f3136)
          .setFields(await Promise.all(fields)),
      );
    }

    return paginate(interaction, embeds);
  }
}
