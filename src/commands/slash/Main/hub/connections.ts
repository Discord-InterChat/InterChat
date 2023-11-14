import { ChatInputCommandInteraction, CacheType, EmbedBuilder } from 'discord.js';
import Hub from './index.js';
import { stripIndent } from 'common-tags';
import { emojis } from '../../../../utils/Constants.js';
import { paginate } from '../../../../utils/Pagination.js';
import db from '../../../../utils/Db.js';
import { errorEmbed } from '../../../../utils/Utils.js';

export default class Connections extends Hub {
  async execute(interaction: ChatInputCommandInteraction<CacheType>): Promise<unknown> {
    await interaction.deferReply();

    const hub = interaction.options.getString('hub', true);
    const hubExists = await db.hubs.findUnique({ where: { name: hub } });

    if (!hubExists) {
      return await interaction.editReply({
        embeds: [errorEmbed(`${emojis.no} Hub **${hub}** doesn't exist.`)],
      });
    }
    else if (
      hubExists.ownerId !== interaction.user.id ||
      !hubExists.moderators.some((mod) => mod.userId === interaction.user.id)
    ) {
      return await interaction.editReply({
        embeds: [errorEmbed(`${emojis.no} You don't own or moderate **${hub}**.`)],
      });
    }

    const allNetworks = await db.connectedList.findMany({
      where: { hub: { id: hubExists.id } },
      orderBy: { date: 'asc' },
    });

    if (allNetworks.length === 0) {
      return await interaction.editReply(`${emojis.no} No connected servers yet.`);
    }

    const embeds: EmbedBuilder[] = [];
    let itemsPerPage = 5;

    for (let index = 0; index < allNetworks.length; index += 5) {
      const current = allNetworks?.slice(index, itemsPerPage);

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

        const setup = allNetworks.find((settings) => settings.channelId === connection.channelId);
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
          .setDescription(`Current connected servers: ${++l}-${j} / **${allNetworks.length}**`)
          .setColor(0x2f3136)
          .setFields(await Promise.all(fields)),
      );
    }

    return paginate(interaction, embeds);
  }
}
