const { ActionRow, MessageButton, EmbedBuilder } = require('discord.js');
const { colors } = require('../../utils');

module.exports = {
	async execute(interaction) {
		const row = new ActionRow()
			.addComponents(
				new MessageButton()
					.setCustomId('yes')
					.setLabel('Yes')
					.setStyle('SUCCESS'),
				new MessageButton()
					.setCustomId('no')
					.setLabel('No')
					.setStyle('DANGER'),
			);
		await interaction.reply({ content: 'Do you want to send this suggestion to the ChatBot HQ Server?', components: [row] });
		const message = await interaction.fetchReply();
		const collector = message.createMessageComponentCollector({ componentType: 'BUTTON', time: 10000, idle: 10000, max: 1 });

		collector.on('collect', async i => {
			if (i.user.id === interaction.user.id) {
				if (i.customId === 'yes') {
					const suggestion = interaction.options.getString('suggestion');
					const embed = new EmbedBuilder()
						.setTitle('New Suggestion')
						.setDescription(suggestion)
						.setAuthor({ name: `Suggested By: ${interaction.member.user.tag}`, iconURL: interaction.member.user.avatarURL({ dynamic: true }) })
						.setFooter(`From Server: ${interaction.guild.name}`, interaction.guild.iconURL({ dynamic: true }))
						.setTimestamp()
						.setColor(colors());

					const suggestionChannel = await interaction.client.channels.fetch('908713477433073674');

					await interaction.followUp('Thank you for your suggestion!');
					await suggestionChannel.send({ content: '@Developers', embeds: [embed] });
				}
				else {
					await interaction.followUp('Ok, discarding suggestion.');
				}
			}
			else {
				await i.channel.send({ content: 'This is not your interaction.' });
			}
		});
		collector.on('end', async () => {
			const reply = await interaction.fetchReply();
			await reply.edit({ content: reply.content, components: [] });
		});
	},
};