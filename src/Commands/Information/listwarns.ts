import { stripIndents } from 'common-tags';
import { AutocompleteInteraction, ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { checkIfStaff, getDb } from '../../Utils/functions/utils';

export default {
  data: new SlashCommandBuilder()
    .setName('listwarns')
    .setDescription('List all warnings for a user.')
    .addStringOption((option) =>
      option
        .setName('user')
        .setDescription('The user to list warnings for. Use their ID if they are not in the server.')
        .setRequired(false)
        .setAutocomplete(true),
    ),
  async execute(interaction: ChatInputCommandInteraction) {
    const db = getDb();
    const userId = interaction.options.getString('user');
    const emojis = interaction.client.emoji;

    // if user is not staff the ID they provided is someone else's
    const staffUser = await checkIfStaff(interaction.user);
    if (!staffUser && userId !== interaction.user.id) {
      return interaction.reply({
        content: `${emojis.normal.no} You do not have the necessary permissions to view warnings given to other users.`,
        ephemeral: true,
      });
    }

    // fetch the user from discord to check if they actually exist
    const user = userId
      ? await interaction.client.users.fetch(userId)
        .catch(() => {
          return interaction.client.users.cache.find((usr) => usr.tag === userId);
        })
      : interaction.user;

    // reply with an error if they don't
    if (!user) {
      return interaction.reply({
        content: `${emojis.normal.no} Invalid user provided.`,
        ephemeral: true,
      });
    }

    // check in Db if that entry exists
    const userWarns = await db.userWarns.findFirst({ where: { userId: user.id } });

    // reply with an error if that entry doesn't exist
    if (!userWarns?.warnings) {
      return interaction.reply({
        content: `${emojis.normal.yes} No warnings found!`,
        ephemeral: true,
      });
    }

    const warnList = userWarns.warnings.map((warn, index) => {
      return {
        name: `${index + 1}. ${warn.id}`,
        value: stripIndents`
        ${emojis.normal.dotRed}Moderator: <@${warn.moderatorId}>
        ${emojis.normal.dotRed}Date: <t:${Math.round(warn.timestamp?.getTime() / 1000)}:d>
        ${emojis.normal.dotRed}Reason: ${warn.reason}`,
      };
    });
    const embed = new EmbedBuilder()
      .setAuthor({ name: `Warnings for ${user.tag}`, iconURL: user.avatarURL() || user.defaultAvatarURL })
      .setDescription(`**Total Warnings:** ${userWarns.warnings.length}`)
      .setFields(warnList)
      .setColor('Random')
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
  async autocomplete(interaction: AutocompleteInteraction) {
    const allWarns = await getDb().userWarns.findMany();
    const choices = allWarns.map((warn) => {
      return { name: warn.userTag, value: warn.userId };
    });

    const staffUser = await checkIfStaff(interaction.user);

    if (!staffUser) return interaction.respond([]);

    const focusedValue = interaction.options.getFocused().toLowerCase();
    const filtered = choices
      .filter((choice) =>
        choice.name.toLowerCase().includes(focusedValue) ||
        choice.value.toLowerCase().includes(focusedValue),
      )
      .slice(0, 25);

    interaction.respond(filtered);
  },
};