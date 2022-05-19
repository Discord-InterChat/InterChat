const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder } = require('discord.js');
const { stripIndents } = require('common-tags');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('updates')
		.setDescription('Notes on updates for ChatBot'),
	async execute(interaction) {
		const embed = new EmbedBuilder()
			.setTitle('Update Notes')
			.setAuthor({ name: 'Requested By: ' + interaction.user.tag, iconURL: interaction.user.avatarURL({ dynamic: true }) })
			.setFooter({ text: interaction.client.user.tag, iconURL: interaction.client.user.avatarURL() })
			.setDescription(stripIndents`
			Hey!
			ChatBot has gone through a major update and is now ready to be used on a larger scale. The entire code has been rewritten from Python (discord.py) to JavaScript (discord.js), and we have converted from traditional prefixes to slash commands. **Due to this, you will have to re-invite ChatBot *with* slash command permissions for it to work properly.** [Click Here](<${interaction.client.generateInvite({ scopes: ['applications.commands', 'bot'] })}>)

			The staff team is planning to make a few major changes and here is what to expect in a few weeks to a few months:
			• Rebranding - The name 'ChatBot' leads users into thinking that this is an AI chatbot and it annoys both them and us. We have not yet decided a new name, but we will soon.
			• Anonymity Feature - Users or Servers may be sensitive about their names, so they may want to be anonymous. This may be available only for voters.
			• Inactivity - If a server is inactive for over a day, it will be removed from the database.
			• Premium - Voters will get the 'Premium' status which allows them to use certain features, including Anonymity.
								
			There are a few more things the staff are discussing about, but it is not certain whether they will be implemented or not.
			If you have any questions, feel free to contact us.

			BTW ChatBot has reached 300 servers, and it has been over 1 year since we got verified :partying_face: :partying_face:! So thank you for sticking with us this entire time!

			:christmas_tree: Merry Christmas :christmas_tree: and a :calendar_spiral: Happy New Year! :calendar_spiral:
			- The ChatBot Staff Team <a:staff:789764656549068820>
			`);
		await interaction.reply({ embeds: [embed] });
	},
};