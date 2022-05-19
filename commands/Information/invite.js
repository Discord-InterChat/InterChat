const { SlashCommandBuilder } = require('@discordjs/builders');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionsBitField } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('invite')
		.setDescription('Invite the bot to your server'),
	async execute(interaction) {
		const Normal = new ActionRowBuilder()
			.addComponents([
				new ButtonBuilder()
				// .setCustomId('primary')
					.setLabel('Normal')
					.setURL(interaction.client.generateInvite({ scopes: ['applications.commands', 'bot'] }))
					.setStyle(ButtonStyle.Link)
					.setEmoji('<:Add:910150366035861554>')
					.setDisabled(false),

			]);
		const Admin = new ActionRowBuilder()
			.addComponents([
				new ButtonBuilder()
				// .setCustomId('primary')
					.setLabel('Administrator')
					.setURL(interaction.client.generateInvite({ scopes: ['applications.commands', 'bot'], permissions: PermissionsBitField.Flags.Administrator }))
					.setStyle(ButtonStyle.Link)
					.setEmoji('<:DiscordStaff:910149173146443876>')
					.setDisabled(false),

			]);
		await interaction.reply({ content: 'Click the button to invite!\n\n<:add:924310865656827924> **Administrator** - For big servers with complex permission systems.\n**<:Add:910150366035861554> Normal** - For normal functionality of the bot.  \n\n\n__Support Server__: https://discord.gg/6bhXQynAPs', components: [Admin, Normal], ephemeral:true });
	},
};