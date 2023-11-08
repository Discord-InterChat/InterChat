import { ChatInputCommandInteraction, CacheType, EmbedBuilder } from 'discord.js';
import Hub from './index.js';
import { stripIndent } from 'common-tags';
import { emojis } from '../../../../utils/Constants.js';
import { paginate } from '../../../../utils/Pagination.js';
import db from '../../../../utils/Db.js';

export default class Connections extends Hub {
  async execute(interaction: ChatInputCommandInteraction<CacheType>): Promise<unknown> {
    await interaction.deferReply();

    const hub = interaction.options.getString('hub', true);
    const allNetworks = await db.connectedList.findMany({
      where: {
        hub: {
          name: hub,
          OR: [
            { ownerId: interaction.user.id },
            { moderators: { some: { userId: interaction.user.id } } },
          ],
        },
      },
      orderBy: { date: 'asc' },
    });

    if (allNetworks.length === 0) {return interaction.editReply(`No connected servers yet ${emojis.bruhcat}`);}

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
              const channel = await server?.channels.fetch(ctx.connection.channelId).catch(() => null);
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
          value += '\n' +
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
