import { EmbedBuilder, ChatInputCommandInteraction, User } from 'discord.js';
import { stripIndents } from 'common-tags';
import { colors, getDb } from '../../Utils/functions/utils';


const embedGen = async (user: User) => {
  const userInBlacklist = await getDb().blacklistedUsers?.findFirst({ where: { userId: user.id } });

  const owns = user.client.guilds.cache
    .filter((guild) => guild.ownerId == user.id)
    .map((guild) => guild.name);

  const { icons } = user.client.emotes;

  return new EmbedBuilder()
    .setAuthor({ name: user.username, iconURL: user.avatarURL()?.toString() })
    .setColor(colors('invisible'))
    .setImage(user.bannerURL({ size: 1024 }) || null)
    .setThumbnail(user.avatarURL())
    .addFields([
      {
        name: 'User',
        value: stripIndents`
          > ${icons.mention} **Username:** ${user.username}
          > ${icons.id} **ID:** ${user.id}
          > ${icons.members} **Created:** <t:${Math.round(user.createdTimestamp / 1000)}:R>
          > ${icons.bot} **Bot:** ${user.bot}`,
      },
      {
        name: 'Network',
        value: stripIndents`
          > ${icons.owner} **Owns:** ${owns.length > 0 ? owns.join(', ') : 'None'}
          > ${icons.delete} **Blacklisted:** ${userInBlacklist ? 'Yes' : 'No'}`,
      },
    ]);
};


export default {
  async execute(interaction: ChatInputCommandInteraction, userId: string, hidden: boolean) {
    const user = await interaction.client.users.fetch(userId).catch(() => null);
    if (!user) return interaction.reply({ content: 'Unknown user. Try using user\'s ID instead if you used username.', ephemeral: true });

    await interaction.reply({
      content: user.id,
      embeds: [await embedGen(user)],
      ephemeral: hidden,
    });

  },
};

