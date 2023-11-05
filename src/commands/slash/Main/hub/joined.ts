import { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { paginate } from '../../../../utils/Pagination.js';
import Hub from './index.js';
import { emojis } from '../../../../utils/Constants.js';
import db from '../../../../utils/Db.js';

export default class Joined extends Hub {
  async execute(interaction: ChatInputCommandInteraction) {
    const connections = await db.connectedList.findMany({
      where: { serverId: interaction.guild?.id },
      include: { hub: true },
    });
    if (connections.length === 0) {
      return await interaction.reply(`${emojis.no} You have not joined any hubs yet!`);
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

    await interaction.reply({ embeds: [embed] });
  }
}
