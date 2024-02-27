import { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import Hub from './index.js';
import { colors, emojis } from '../../../../utils/Constants.js';
import { paginate } from '../../../../utils/Pagination.js';
import db from '../../../../utils/Db.js';
import { simpleEmbed } from '../../../../utils/Utils.js';
import { t } from '../../../../utils/Locale.js';
import SuperClient from '../../../../core/Client.js';

export default class Servers extends Hub {
  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    const hubOpt = interaction.options.getString('hub', true);
    const serverOpt = interaction.options.getString('server');
    const locale = interaction.user.locale;

    const hub = await db.hubs.findUnique({
      where: { name: hubOpt },
      include: { connections: true },
    });

    if (!hub) {
      await interaction.editReply({
        embeds: [simpleEmbed(t({ phrase: 'hub.notFound', locale }, { emoji: emojis.no }))],
      });
      return;
    } else if (
      hub.ownerId !== interaction.user.id &&
      !hub.moderators.some((mod) => mod.userId === interaction.user.id)
    ) {
      await interaction.editReply({
        embeds: [simpleEmbed(t({ phrase: 'hub.notFound_mod', locale }, { emoji: emojis.no }))],
      });
      return;
    }

    if (hub.connections.length === 0) {
      await interaction.editReply({
        embeds: [
          simpleEmbed(t({ phrase: 'hub.servers.noConnections', locale }, { emoji: emojis.no })),
        ],
      });
      return;
    }

    if (serverOpt) {
      const connection = hub.connections.find((con) => con.serverId === serverOpt);
      if (!connection) {
        return await interaction.editReply({
          embeds: [
            simpleEmbed(
              t(
                { phrase: 'hub.servers.notConnected', locale },
                { hub: hub.name, emoji: emojis.no },
              ),
            ),
          ],
        });
      }
      const server = await interaction.client.guilds.fetch(serverOpt).catch(() => null);
      const channel = await server?.channels.fetch(connection.channelId).catch(() => null);
      const embed = new EmbedBuilder()
        .setTitle(`${server?.name} \`(${connection.serverId})\``)
        .setColor(colors.interchatBlue)
        .setDescription(
          t(
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

      await interaction.editReply({ embeds: [embed] });
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

        const evalRes = SuperClient.resolveEval(evalArr);

        const value = t(
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
            t(
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
