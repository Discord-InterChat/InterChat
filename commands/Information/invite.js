const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageActionRow, MessageButton, Permissions } = require('discord.js');
const { normal } = require('../../emoji.json');
module.exports = {
	data: new SlashCommandBuilder()
		.setName('invite')
		.setDescription('Invite the bot to your server'),
	async execute(interaction) {
		const permissions = [Permissions.FLAGS.MANAGE_CHANNELS, Permissions.FLAGS.CHANGE_NICKNAME, Permissions.FLAGS.VIEW_CHANNEL, Permissions.FLAGS.SEND_MESSAGES, Permissions.FLAGS.SEND_MESSAGES_IN_THREADS, Permissions.FLAGS.MANAGE_CHANNELS, Permissions.FLAGS.MANAGE_MESSAGES, Permissions.FLAGS.MANAGE_THREADS, Permissions.FLAGS.EMBED_LINKS, Permissions.FLAGS.ATTACH_FILES, Permissions.FLAGS.READ_MESSAGE_HISTORY, Permissions.FLAGS.USE_EXTERNAL_EMOJIS, Permissions.FLAGS.ADD_REACTIONS];

		const InviteButtons = new MessageActionRow()
			.addComponents([
				new MessageButton()
					.setLabel('Normal')
					.setURL(interaction.client.generateInvite({ scopes: ['applications.commands', 'bot'], permissions: permissions }))
					.setStyle('LINK')
					.setEmoji(normal.invite)
					.setDisabled(false),
				new MessageButton()
					.setLabel('Administrator')
					.setURL(interaction.client.generateInvite({ scopes: ['applications.commands', 'bot'], permissions: Permissions.FLAGS.ADMINISTRATOR }))
					.setStyle('LINK')
					.setEmoji(normal.chatbotStaff)
					.setDisabled(false),

			]);
		await interaction.reply({ content: `Click the button to invite!\n\n${normal.invite} **Administrator** - For big servers with complex permission systems.\n**${normal.invite} Normal** - For normal functionality of the bot.  \n\n\n__Support Server__: https://discord.gg/6bhXQynAPs`, components: [InviteButtons], ephemeral:true });
	},
};