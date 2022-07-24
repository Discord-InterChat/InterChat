const { ActionRowBuilder, ButtonBuilder, PermissionFlagsBits, SlashCommandBuilder, ButtonStyle } = require('discord.js');
const { normal } = require('../../emoji.json');
module.exports = {
	data: new SlashCommandBuilder()
		.setName('invite')
		.setDescription('Invite the bot to your server'),
	async execute(interaction) {
		const permissions = [PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ManageWebhooks, PermissionFlagsBits.ChangeNickname, PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.SendMessagesInThreads, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ManageMessages, PermissionFlagsBits.ManageThreads, PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.UseExternalEmojis, PermissionFlagsBits.AddReactions, PermissionFlagsBits.ManageGuild];

		const InviteButtons = new ActionRowBuilder()
			.addComponents([
				new ButtonBuilder()
					.setLabel('Normal')
					.setURL(interaction.client.generateInvite({ scopes: ['applications.commands', 'bot'], permissions: permissions }))
					.setStyle(ButtonStyle.Link)
					.setEmoji(normal.invite)
					.setDisabled(false),
				new ButtonBuilder()
					.setLabel('Administrator')
					.setURL(interaction.client.generateInvite({ scopes: ['applications.commands', 'bot'], permissions: PermissionFlagsBits.Administrator }))
					.setStyle(ButtonStyle.Link)
					.setEmoji(normal.chatbotStaff)
					.setDisabled(false),

			]);
		await interaction.reply({ content: `Click the button to invite!\n\n${normal.invite} **Administrator** - For big servers with complex permission systems.\n**${normal.invite} Normal** - For normal functionality of the bot.  \n\n\n__Support Server__: https://discord.gg/6bhXQynAPs`, components: [InviteButtons], ephemeral:true });
	},
};