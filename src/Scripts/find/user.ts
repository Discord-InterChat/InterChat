import { EmbedBuilder, ChatInputCommandInteraction, ActionRowBuilder, ButtonBuilder, ButtonStyle, User, ComponentType } from 'discord.js';
import { stripIndents } from 'common-tags';
import { checkIfStaff, colors, getDb } from '../../Utils/functions/utils';
import { modActions } from '../networkLogs/modActions';


const components = async (user: User) => {
  const userInBlacklist = await getDb().blacklistedUsers?.findFirst({ where: { userId: user.id } });

  return new ActionRowBuilder<ButtonBuilder>({
    components: [
      new ButtonBuilder({
        customId: `${userInBlacklist ? 'unblacklist' : 'blacklist'}`,
        label: `${userInBlacklist ? 'Unblacklist' : 'Blacklist'}`,
        style: userInBlacklist ? ButtonStyle.Success : ButtonStyle.Danger,
      }),
    ],
  });
};

const embedGen = async (user: User) => {
  const userInBlacklist = await getDb().blacklistedUsers?.findFirst({ where: { userId: user.id } });

  const owns = user.client.guilds.cache
    .filter((guild) => guild.ownerId == user.id)
    .map((guild) => guild.name);

  const { icons } = user.client.emotes;

  return new EmbedBuilder()
    .setAuthor({ name: user.tag, iconURL: user.avatarURL()?.toString() })
    .setColor(colors('invisible'))
    .setImage(user.bannerURL({ size: 1024 }) || null)
    .setThumbnail(user.avatarURL())
    .addFields([
      {
        name: 'User',
        value: stripIndents`
          > ${icons.mention} **Tag:** ${user.tag}
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


export = {
  async execute(interaction: ChatInputCommandInteraction, userId: string, hidden: boolean) {
    const user = await interaction.client.users.fetch(userId).catch(() => null);
    if (!user) return interaction.reply({ content: 'Unknown user.', ephemeral: true });

    const blacklistedUsers = getDb().blacklistedUsers;

    const userEmbed = await interaction.reply({
      content: user.id,
      embeds: [await embedGen(user)],
      components: [await components(user)],
      ephemeral: hidden,
    });

    const collector = userEmbed.createMessageComponentCollector({
      filter: async (i) => i.user.id === interaction.user.id && await checkIfStaff(i.user),
      componentType: ComponentType.Button,
    });

    collector.on('collect', async (i) => {
      switch (i.customId) {
        case 'blacklist':
          await blacklistedUsers?.create({
            data: {
              username: `${user.username}#${user.discriminator}`,
              userId: user.id,
              reason: 'Blacklisted through `/find`.',
              notified: true,
            },

          });
          await i.update({ embeds: [await embedGen(user)], components: [await components(user)] });
          i.followUp({ content: 'User blacklisted.', ephemeral: hidden });
          modActions(i.user, { action: 'blacklistUser', user, reason: 'Blacklisted through `/find`.' });
          break;
        case 'unblacklist':
          await blacklistedUsers?.delete({ where: { userId: user.id } });
          await i.update({ embeds: [await embedGen(user)], components: [await components(user)] });
          i.followUp({ content: 'User removed from blacklist.', ephemeral: hidden });
          modActions(i.user, { action: 'unblacklistUser', user, reason: 'Unblacklisted through `/find`.' });
          break;
        default:
          break;
      }
    });
  },
};

