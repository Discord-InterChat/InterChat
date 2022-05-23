const { SlashCommandBuilder } = require('@discordjs/builders');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionsBitField } = require('discord.js');
const { normal } = require('../../emoji.json');
module.exports = {
	data: new SlashCommandBuilder()
		.setName('invite')
		.setDescription('Invite the bot to your server'),
	async execute(interaction) {
		const Normal = new ActionRowBuilder()
			.addComponents([
				new ButtonBuilder()
					.setLabel('Normal')
					.setURL(interaction.client.generateInvite({ scopes: ['applications.commands', 'bot'] }))
					.setStyle(ButtonStyle.Link)
					.setEmoji(normal.invite)
					.setDisabled(false),

			]);
		const Admin = new ActionRowBuilder()
			.addComponents([
				new ButtonBuilder()
					.setLabel('Administrator')
					.setURL(interaction.client.generateInvite({ scopes: ['applications.commands', 'bot'], permissions: PermissionsBitField.Flags.Administrator }))
					.setStyle(ButtonStyle.Link)
					.setEmoji(normal.chatbotStaff)
					.setDisabled(false),

			]);
		await interaction.reply({ content: `Click the button to invite!\n\n${normal.invite} **Administrator** - For big servers with complex permission systems.\n**${normal.invite} Normal** - For normal functionality of the bot.  \n\n\n__Support Server__: https://discord.gg/6bhXQynAPs`, components: [Admin, Normal], ephemeral:true });
	},
};