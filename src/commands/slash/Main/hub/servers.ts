import { colors, emojis } from '#main/utils/Constants.js';
import db from '#main/utils/Db.js';
import { t } from '#main/utils/Locale.js';
import { paginate } from '#main/utils/Pagination.js';
import { resolveEval, simpleEmbed } from '#main/utils/Utils.js';
import { type ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import Hub from './index.js';

export default class Servers extends Hub {
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply();

    const hubOpt = interaction.options.getString('hub', true);
    const serverOpt = interaction.options.getString('server');
    const { userManager } = interaction.client;
    const locale = await userManager.getUserLocale(interaction.user.id);

    const hub = await db.hubs.findUnique({
      where: { name: hubOpt },
      include: { connections: true },
    });

    if (!hub) {
      await interaction.editReply({
        embeds: [simpleEmbed(t({ phrase: 'hub.notFound', locale }, { emoji: emojis.no }))],
      });
      return;
    }
    else if (
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
        await interaction.editReply({
          embeds: [
            simpleEmbed(
              t(
                { phrase: 'hub.servers.notConnected', locale },
                { hub: hub.name, emoji: emojis.no },
              ),
            ),
          ],
        });
        return;
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

      let itemCounter = index;
      let embedFromIndex = index;
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
            return null;
          },
          { context: { connection } },
        );

        const evalRes = resolveEval(evalArr);

        const value = t(
          { phrase: 'hub.servers.connectionInfo', locale },
          {
            channelName: `${evalRes?.channelName}`,
            channelId: connection.channelId,
            joinedAt: `<t:${Math.round(connection.date.getTime() / 1000)}:d>`,
            invite: connection.invite ? connection.invite : 'Not Set.',
            connected: connection.connected ? 'Yes' : 'No',
          },
        );

        return { name: `${++itemCounter}. ${evalRes?.serverName}`, value };
      });

      embeds.push(
        new EmbedBuilder()
          .setDescription(
            t(
              { phrase: 'hub.servers.total', locale },
              {
                from: `${++embedFromIndex}`,
                to: `${itemCounter}`,
                total: `${hub.connections.length}`,
              },
            ),
          )
          .setColor(0x2f3136)
          .setFields(await Promise.all(fields)),
      );
    }

    paginate(interaction, embeds);
  }
}
