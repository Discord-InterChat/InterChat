import { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { getDb } from '../../Utils/misc/utils';
import { paginate } from '../../Utils/misc/paginator';
import emojis from '../../Utils/JSON/emoji.json';

export default {
  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    const db = getDb();
    const connections = await db.connectedList.findMany({
      where: { serverId: interaction.guild?.id },
      include: { hub: true },
    });
    if (connections.length === 0) {
      return interaction.editReply(`${emojis.normal.no} You have not joined any hubs yet!`);
    }

    const allFields = connections.map((con) => ({
      name: `${con.hub?.name}`,
      value: `<#${con.channelId}>`,
      inline: true,
    }));

    if (allFields.length > 25) {
      const paginateEmbeds: EmbedBuilder[] = [];
      let currentEmbed: EmbedBuilder | undefined;

      // Split the fields into multiple embeds
      allFields.forEach((field, index) => {
        if (index % 25 === 0) {
        // Start a new embed
          currentEmbed = new EmbedBuilder()
            .setTitle('Joined hubs')
            .setDescription(`This server is a part of **${connections.length}** hub(s).`)
            .setColor('Blue')
            .setFooter({
              text: 'Use /hub leave <name> to leave a hub.',
            });
          paginateEmbeds.push(currentEmbed);
        }

        // Add the field to the current embed
        if (currentEmbed) {
          currentEmbed.addFields(field);
        }
      });

      paginate(interaction, paginateEmbeds);
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle('Joined hubs')
      .setDescription(`This server is a part of **${connections.length}** hub(s).`)
      .setFields(allFields)
      .setColor('Blue')
      .setFooter({
        text: 'Use /hub leave <name> to leave a hub.',
      });
    await interaction.editReply({ embeds: [embed] });
  },
};