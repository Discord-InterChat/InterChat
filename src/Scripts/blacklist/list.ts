import { hubs } from '@prisma/client';
import { stripIndents } from 'common-tags';
import { APIEmbedField, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { paginate } from '../../Utils/paginator';
import { constants, getDb } from '../../Utils/utils';

module.exports = {
  async execute(interaction: ChatInputCommandInteraction, hub: hubs) {
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
      const result = await getDb().blacklistedServers.findMany({ where: { hubs: { some: { hubId: hub.id } } } });

      result.forEach((data, index) => {
        const hubData = data.hubs.find(({ hubId }) => hubId === hub.id);
        fields.push({
          name: data.serverName,
          value: stripIndents`
          **ServerId:** ${data.serverId}
          **Reason:** ${hubData?.reason}
          **Expires:** ${!hubData?.expires ? 'Never.' : `<t:${Math.ceil(hubData.expires.getTime() / 1000)}:R>`}     
          `,
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
      const result = await getDb().blacklistedUsers.findMany({ where: { hubs: { some: { hubId: hub.id } } } });

      result.forEach((data, index) => {
        const hubData = data.hubs.find(({ hubId }) => hubId === hub.id);

        fields.push({
          name: data.username,
          value: stripIndents`
          **UserID:** ${data.userId}
          **Reason:** ${hubData?.reason}
          **Expires:** ${!hubData?.expires ? 'Never.' : `<t:${Math.ceil(hubData.expires.getTime() / 1000)}:R>`}
          `,
        });

        counter++;
        if (counter >= LIMIT || index === result.length - 1) {
          embeds.push(new EmbedBuilder()
            .setFields(fields)
            .setColor(constants.colors.interchatBlue)
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
