const { MessageButton, MessageEmbed, MessageActionRow, CommandInteraction } = require('discord.js');
const { normal, icons } = require('../../emoji.json');

module.exports = {
	/**
	 * @param {CommandInteraction} interaction
	 */
	async execute(interaction) {
		const row = new MessageActionRow()
			.addComponents([
				new MessageButton()
					.setCustomId('yes')
					.setLabel('Yes')
					.setStyle('SUCCESS'),
				new MessageButton()
					.setCustomId('no')
					.setLabel('No')
					.setStyle('DANGER'),
			]);

		await interaction.reply({ content: 'Do you want to send this suggestion to the ChatBot HQ Server?', components: [row] });
		const message = await interaction.fetchReply();
		const collector = message.createMessageComponentCollector({ time: 10000, idle: 10000, max: 1 });

		collector.on('collect', async i => {
			if (i.user.id === interaction.user.id) {
				if (i.customId === 'yes') {
					const suggestion = interaction.options.getString('suggestion');
					const embed = new MessageEmbed()
						.setTitle('New Suggestion')
						.setDescription(suggestion)
						.setAuthor({ name: `Suggested By: ${interaction.member.user.tag}`, iconURL: interaction.member.user.avatarURL({ dynamic: true }) })
						.setFooter({ text: `From Server: ${interaction.guild.name}`, iconURL: interaction.guild.iconURL({ dynamic: true }) })
						.setTimestamp()
						.setColor('#3bd0ff');

					const suggestionChannel = await interaction.client.channels.fetch('908713477433073674');

					if (interaction.options.getAttachment('attachment')) embed.setImage(interaction.options.getAttachment('attachment').url);

					const reviewChannel = await interaction.client.channels.fetch('865067410271633408');
					row.components[0].setEmoji(normal.yes).setLabel('Approve');
					row.components[1].setEmoji(normal.no).setLabel('Deny');
					const reviewMessage = await reviewChannel.send({ embeds: [embed], components: [row], fetchReply: true });
					const reviewCollector = reviewMessage.createMessageComponentCollector({ time: 1000 * 1000 * 60, max: 3 });

					reviewCollector.on('collect', async collected => {
						collected.deferUpdate();
						if (collected.customId === 'yes') {
							const suggestionMsg = await suggestionChannel.send({ embeds: [embed] });
							suggestionMsg.react(normal.yes);
							suggestionMsg.react(normal.no);


							const approveEmbed = new MessageEmbed()
								.addFields({ name: 'Approver', value: i.user.tag })
								.setTitle('ChatBot Suggestions')
								.setDescription(`Your suggestion **${suggestion.split(' ').slice(0, 6).join(' ')}...** has been approved! You can view your suggestion in the <#908713477433073674> channel.`)
								.setTimestamp()
								.setURL('https://discord.gg/VEUPEy2nyq')
								.setColor('#60ec11');

							interaction.member.send({ embeds: [approveEmbed] });
							return reviewCollector.stop();
						}
						else {
							interaction.member.send(`Your suggestion **${suggestion.split(' ').slice(0, 4).join(' ')}...** has been rejected. If you have any questions please join the support server.\n**Common Reasons:** Already exists, inappropriate word/image usage.`);
							return reviewCollector.stop();
						}
					});
					reviewCollector.on('end', () => {
						reviewMessage.edit({ content: `${icons.info} Suggestion reviewed by **${i.user.tag}**!`, components: [] });
					});


					await interaction.followUp('Thank you for your suggestion! It has been sent for review.');
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
			await reply.edit({ components: [] });
		});
	},
};