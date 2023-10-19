import { APIEmbedField, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import db from '../../../../utils/Db.js';
import BlacklistCommand from './index.js';
import { stripIndents } from 'common-tags';
import { paginate } from '../../../../utils/Pagination.js';
import { colors } from '../../../../utils/Constants.js';

export default class ListBlacklists extends BlacklistCommand {
  async execute(interaction: ChatInputCommandInteraction) {
    const hub = interaction.options.getString('hub', true);

    const hubInDb = await db.hubs.findFirst({ where: {
      name: hub,
      OR: [
        { ownerId: interaction.user.id },
        { moderators: { some: { userId: interaction.user.id } } },
      ],
    },
    });

    if (!hubInDb) {
      return await interaction.reply({
        content: 'Unknown hub. Make sure you are the owner or a moderator of the hub.',
        ephemeral: true,
      });
    }

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
      const result = await db.blacklistedServers.findMany({ where: { hubs: { some: { hubId: hubInDb.id } } } });

      result.forEach((data, index) => {
        const hubData = data.hubs.find(({ hubId }) => hubId === hubInDb.id);
        fields.push({
          name: data.serverName,
          value: stripIndents`
          **ServerId:** ${data.serverId}
          **Reason:** ${hubData?.reason}
          **Expires:** ${!hubData?.expires ? 'Never.' : `<t:${Math.round(hubData.expires.getTime() / 1000)}:R>`}     
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
      const result = await db.blacklistedUsers.findMany({ where: { hubs: { some: { hubId: hubInDb.id } } } });

      result.forEach((data, index) => {
        const hubData = data.hubs.find(({ hubId }) => hubId === hubInDb.id);

        fields.push({
          name: data.username,
          value: stripIndents`
          **UserID:** ${data.userId}
          **Reason:** ${hubData?.reason}
          **Expires:** ${!hubData?.expires ? 'Never.' : `<t:${Math.round(hubData.expires.getTime() / 1000)}:R>`}
        `,
        });

        counter++;
        if (counter >= LIMIT || index === result.length - 1) {
          embeds.push(new EmbedBuilder()
            .setFields(fields)
            .setColor(colors.interchatBlue)
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
  }
}