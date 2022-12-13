import { PrismaClient } from '@prisma/client';
import { APIEmbedField, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { paginate } from '../../Utils/functions/paginator';
import { colors } from '../../Utils/functions/utils';

module.exports = {
  async execute(interaction: ChatInputCommandInteraction, database: PrismaClient) {
    const serverOpt = interaction.options.getString('type');

    const embeds: EmbedBuilder[] = [];
    let fields: APIEmbedField[] = [];

    const LIMIT = 5;
    let counter = 0;

    // loop through all data
    // after counter hits limit (5) assign fields to an embed and push to to embeds array
    // reset counter & clear fields array
    // repeat until you reach the end

    if (serverOpt == 'server') {
      const result = await database.blacklistedServers.findMany();

      result.forEach((data, index) => {
        fields.push({
          name: data.serverName,
          value: `${interaction.client.emoji.icons.id}: ${data.serverId}\nReason: ${data.reason}\n\n`,
        });

        counter++;
        if (counter >= LIMIT || index === result.length - 1) {
          embeds.push(new EmbedBuilder()
            .setFields(fields)
            .setColor('#0099ff')
            .setAuthor({
              name: 'Blacklisted Servers:',
              iconURL: interaction.client.user?.avatarURL()?.toString(),
            }));

          counter = 0;
          fields = [];
        }
      });
    }
    else if (serverOpt == 'user') {
      const result = await database.blacklistedUsers.findMany();

      result.forEach((data, index) => {
        fields.push({
          name: data.username,
          value: `${interaction.client.emoji.icons.id}: ${data.userId}\nReason: ${data.reason}`,
        });

        counter++;
        if (counter >= LIMIT || index === result.length - 1) {
          embeds.push(new EmbedBuilder()
            .setFields(fields)
            .setColor(colors('chatbot'))
            .setAuthor({
              name: 'Blacklisted Users:',
              iconURL: interaction.client.user?.avatarURL()?.toString(),
            }));

          counter = 0;
          fields = [];
        }
      });
    }

    paginate(interaction, embeds);

  },
};
