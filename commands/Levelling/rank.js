const Levels = require('discord-xp');
const canvacord = require('canvacord');
const { EmbedBuilder, SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const { colors, mainGuilds } = require('../../utils');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('rank')
		.setDescription('Shows the user\'s rank')
		.addUserOption(option =>
			option
				.setRequired(false)
				.setName('user')
				.setDescription('Check another user\'s rank'),
		),
	async execute(interaction) {
		const otheruser = interaction.options.getUser('user');
		const target = otheruser || interaction.user;

		const user = await Levels.fetch(target.id, mainGuilds.cbhq, true);
		const errorEmbed = new EmbedBuilder().setDescription(`${user?.username || 'User'} doesn't have any xp.. Chat to gain some xp.`);

		if (user == false) return await interaction.reply({ embeds: [errorEmbed] });

		const neededxp = Levels.xpFor(parseInt(user.level) + 1);

		const rankCard = new canvacord.Rank()
			.setAvatar(target.avatarURL())
			.setBackground('IMAGE', 'https://cdn.discordapp.com/attachments/824616172569493504/999660076321210428/blob-scene-haikei.png')
			.setCurrentXP(user.xp).setLevel(user.level || 0)
			.setRequiredXP(neededxp).setRank(user.position)
			.setProgressBar(colors('chatbot'), 'COLOR')
			.setCustomStatusColor(colors('chatbot'))
			.setUsername(target.username)
			.setDiscriminator(target.discriminator);

		rankCard.build().then(async data => {
			await interaction.deferReply();
			const attachment = new AttachmentBuilder(data, { name: 'rankcard.png' });
			return await interaction.followUp({ files: [attachment] });
		});

	},

};