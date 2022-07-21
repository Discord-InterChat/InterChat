const Levels = require('discord-xp');
const canvacord = require('canvacord');
const { EmbedBuilder, SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const { colors, cbhq } = require('../../utils');

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

		const user = await Levels.fetch(target.id, cbhq, true);
		const errorEmbed = new EmbedBuilder().setDescription(`${user?.username || 'User'} doesn't have any xp.. Chat to gain some xp.`);

		if (user == false) return await interaction.reply({ embeds: [errorEmbed] });

		const neededxp = Levels.xpFor(parseInt(user.level) + 1);

		const rankCard = new canvacord.Rank()
			.setAvatar(target.avatarURL())
			.setCurrentXP(user.xp).setLevel(user.level || 0)
			.setRequiredXP(neededxp).setRank(user.position)
			.setProgressBar(colors('chatbot'), 'COLOR')
			.setUsername(target.username)
			.setDiscriminator(target.discriminator);

		rankCard.build().then(async data => {
			await interaction.deferReply();
			const attachment = new AttachmentBuilder(data, { name: 'rankcard.png' });
			return await interaction.followUp({ files: [attachment] });
		});

	},

};