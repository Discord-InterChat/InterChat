import { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { getDb, getGuildName } from '../../Utils/functions/utils';
import { paginate } from '../../Utils/functions/paginator';
import { stripIndent } from 'common-tags';

module.exports = {
  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    const database = getDb();
    const allNetworks = (await database.connectedList.findMany()).reverse();
    const allSetups = await database.setup.findMany();

    if (!allNetworks || allNetworks?.length === 0) return interaction.editReply(`No connected servers yet ${interaction.client.emotes.normal.bruhcat}`);

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
        const setup = allSetups.find((settings) => settings.channelId === connection.channelId);
        let value = stripIndent`
        ServerID: ${connection.serverId}
        Channel: ${channelName} \`(${connection.channelId}\`)
        `;
        if (setup) {
          value += '\n' + stripIndent`
            Setup At: <t:${Math.round(setup?.date?.getTime() / 1000)}:d>
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
