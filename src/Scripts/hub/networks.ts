import { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { getDb, getGuildName } from '../../Utils/functions/utils';
import { paginate } from '../../Utils/functions/paginator';
import { stripIndent } from 'common-tags';

module.exports = {
  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    const db = getDb();
    const hub = interaction.options.getString('hub', true);
    const allNetworks = await db.connectedList.findMany({
      where: {
        hub: {
          name: hub,
          OR: [
            { owner: { is: { userId: interaction.user.id } } },
            { moderators: { some: { userId: interaction.user.id } } },
          ],
        },
      },
      orderBy: { date: 'asc' },
    });

    if (allNetworks.length === 0) return interaction.editReply(`No connected servers yet ${interaction.client.emotes.normal.bruhcat}`);

    const embeds: EmbedBuilder[] = [];
    let itemsPerPage = 5;


    for (let index = 0; index < allNetworks.length; index += 5) {
      const current = allNetworks?.slice(index, itemsPerPage);

      let j = index;
      let l = index;
      itemsPerPage += 5;

      const fields = current.map(connection => {
        const serverName = getGuildName(interaction.client, connection.serverId);
        const channelName = interaction.client.channels.cache.get(connection.channelId);
        const setup = allNetworks.find((settings) => settings.channelId === connection.channelId);
        let value = stripIndent`
        ServerID: ${connection.serverId}
        Channel: ${channelName} \`(${connection.channelId}\`)
        `;
        if (setup) {
          value += '\n' + stripIndent`
            Joined At: <t:${Math.round(setup?.date?.getTime() / 1000)}:d>
            Invite:  ${setup.invite ? `https://discord.gg/${setup.invite}` : 'Not Set.'}`;
        }

        return { name: `${++j}. ${serverName}`, value };
      });

      embeds.push(
        new EmbedBuilder()
          .setDescription(`Current connected servers: ${++l}-${j} / **${allNetworks.length}**`)
          .setColor(0x2F3136)
          .setFields(fields),
      );
    }

    return paginate(interaction, embeds);
  },
};
