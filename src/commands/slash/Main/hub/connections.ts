import { ChatInputCommandInteraction, CacheType, EmbedBuilder } from 'discord.js';
import Hub from './index.js';
import { stripIndent } from 'common-tags';
import { colors, emojis } from '../../../../utils/Constants.js';
import { paginate } from '../../../../utils/Pagination.js';
import db from '../../../../utils/Db.js';
import { errorEmbed } from '../../../../utils/Utils.js';

export default class Connections extends Hub {
  async execute(interaction: ChatInputCommandInteraction<CacheType>): Promise<unknown> {
    await interaction.deferReply();

    const hubOpt = interaction.options.getString('hub', true);
    const serverOpt = interaction.options.getString('server');

    const hub = await db.hubs.findUnique({ where: { name: hubOpt }, include: { connections: true } });

    if (!hub) {
      return await interaction.editReply({
        embeds: [errorEmbed(`${emojis.no} Hub **${hubOpt}** doesn't exist.`)],
      });
    }
    else if (
      hub.ownerId !== interaction.user.id &&
      !hub.moderators.some((mod) => mod.userId === interaction.user.id)
    ) {
      return await interaction.editReply({
        embeds: [errorEmbed(`${emojis.no} You don't own or moderate **${hubOpt}**.`)],
      });
    }


    if (hub.connections.length === 0) {
      return await interaction.editReply(`${emojis.no} No connected servers yet.`);
    }

    if (serverOpt) {
      const connection = hub.connections.find((con) => con.serverId === serverOpt);
      if (!connection) {
        return await interaction.editReply({
          embeds: [errorEmbed(`${emojis.no} Server **${serverOpt}** isn't connected to **${hubOpt}**.`)],
        });
      }
      const server = await interaction.client.guilds.fetch(serverOpt).catch(() => null);
      const channel = await server?.channels.fetch(connection.channelId).catch(() => null);
      const embed = new EmbedBuilder()
        .setTitle(`${server?.name} \`(${connection.serverId})\``)
        .setColor(colors.interchatBlue)
        .setDescription(stripIndent`
          Channel: #${channel?.name} \`(${connection.channelId})\`
          Joined At: <t:${Math.round(connection.date.getTime() / 1000)}:d>
          Invite: ${connection.invite ? connection.invite : 'Not Set.'}
          Connected: ${connection.connected ? 'Yes' : 'No'}
        `);

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

        const evalRes = interaction.client.resolveEval(evalArr);

        const setup = hub.connections.find((settings) => settings.channelId === connection.channelId);
        let value = stripIndent`
          ServerID: ${connection.serverId}
          Channel: #${evalRes?.channelName} \`(${connection.channelId}\`)
        `;
        if (setup) {
          value +=
            '\n' +
            stripIndent`
            Joined At: <t:${Math.round(setup.date.getTime() / 1000)}:d>
            Invite:  ${setup.invite ? setup.invite : 'Not Set.'}
          `;
        }

        return { name: `${++j}. ${evalRes?.serverName}`, value };
      });

      embeds.push(
        new EmbedBuilder()
          .setDescription(`Current connected servers: ${++l}-${j} / **${hub.connections.length}**`)
          .setColor(0x2f3136)
          .setFields(await Promise.all(fields)),
      );
    }

    return paginate(interaction, embeds);
  }
}
