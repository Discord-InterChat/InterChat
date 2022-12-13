import Levels from 'discord-xp';
import canvacord from 'canvacord';
import { EmbedBuilder, SlashCommandBuilder, AttachmentBuilder, ChatInputCommandInteraction } from 'discord.js';
import { colors, constants } from '../../../src/Utils/functions/utils';

export default {
  data: new SlashCommandBuilder()
    .setName('rank')
    .setDescription('Shows the user\'s rank')
    .addUserOption(option =>
      option
        .setRequired(false)
        .setName('user')
        .setDescription('Check another user\'s rank'),
    ),
  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();
    type LeaderboardUser = {
      guildID: string;
      userID: string;
      xp: number;
      level: number;
      position: number;
      username: string | null;
      discriminator: string | null;
    };
    const otheruser = interaction.options.getUser('user');
    const target = otheruser || interaction.user;

    const user: LeaderboardUser = await Levels.fetch(target.id, constants.mainGuilds.cbhq, true) as unknown as LeaderboardUser;
    const errorEmbed = new EmbedBuilder().setDescription(`${user?.username || 'User'} doesn't have any xp.. Chat to gain some xp.`);

    if (!user) return await interaction.followUp({ embeds: [errorEmbed] });

    const neededxp = Levels.xpFor(user.level + 1);

    const rankCard = new canvacord.Rank()
      .setAvatar(target.avatarURL() as string)
      .setBackground('IMAGE', 'https://cdn.discordapp.com/attachments/824616172569493504/999660076321210428/blob-scene-haikei.png')
      .setCurrentXP(user.xp).setLevel(user.level || 0)
      .setRequiredXP(neededxp).setRank(user.position)
      .setProgressBar(String(colors('chatbot')), 'COLOR')
      .setCustomStatusColor(String(colors('chatbot')))
      .setUsername(target.username)
      .setDiscriminator(target.discriminator);

    rankCard.build().then(async (data) => {
      const attachment = new AttachmentBuilder(data, { name: 'rankcard.png' });
      return await interaction.followUp({ files: [attachment] });
    });

  },

};
