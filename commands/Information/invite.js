const { SlashCommandBuilder } = require('@discordjs/builders');
const { ActionRow, MessageButton, Permissions } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('invite')
		.setDescription('Invite the bot to your server'),
	async execute(interaction) {
		const Normal = new ActionRow()
			.addComponents(
				new MessageButton()
				// .setCustomId('primary')
					.setLabel('Normal')
					.setURL(interaction.client.generateInvite({ scopes: ['applications.commands', 'bot'] }))
					.setStyle('LINK')
					.setEmoji('<:Add:910150366035861554>')
					.setDisabled(false),

			);
		const Admin = new ActionRow()
			.addComponents(
				new MessageButton()
				// .setCustomId('primary')
					.setLabel('Administrator')
					.setURL(interaction.client.generateInvite({ scopes: ['applications.commands', 'bot'], permissions: Permissions.FLAGS.ADMINISTRATOR }))
					.setStyle('LINK')
					.setEmoji('<:DiscordStaff:910149173146443876>')
					.setDisabled(false),

			);
		await interaction.reply({ content: 'Click the button to invite!\n\n<:add:924310865656827924> **Administrator** - For big servers with complex permission systems.\n**<:Add:910150366035861554> Normal** - For normal functionality of the bot.  \n\n\n__Support Server__: https://discord.gg/6bhXQynAPs', components: [Admin, Normal], ephemeral:true });
	},
};