const { ButtonBuilder, EmbedBuilder, ActionRowBuilder, ButtonStyle } = require('discord.js');
const { colors } = require('../../utils');
const { normal } = require('../../emoji.json');

module.exports = {
	async execute(interaction) {
		const row = new ActionRowBuilder()
			.addComponents([
				new ButtonBuilder()
					.setCustomId('yes')
					.setLabel('Yes')
					.setStyle(ButtonStyle.Success),
				new ButtonBuilder()
					.setCustomId('no')
					.setLabel('No')
					.setStyle(ButtonStyle.Danger),
			]);
		await interaction.reply({ content: 'Do you want to send this suggestion to the ChatBot HQ Server?', components: [row] });
		const message = await interaction.fetchReply();
		const collector = message.createMessageComponentCollector({ time: 10000, idle: 10000, max: 1 });

		collector.on('collect', async i => {
			if (i.user.id === interaction.user.id) {
				if (i.customId === 'yes') {
					const suggestion = interaction.options.getString('suggestion');
					const embed = new EmbedBuilder()
						.setTitle('New Suggestion')
						.setDescription(suggestion)
						.setAuthor({ name: `Suggested By: ${interaction.member.user.tag}`, iconURL: interaction.member.user.avatarURL({ dynamic: true }) })
						.setFooter({ text: `From Server: ${interaction.guild.name}`, iconURL: interaction.guild.iconURL({ dynamic: true }) })
						.setTimestamp()
						.setColor(colors());
					// change channelId to cbhq later [change]
					const suggestionChannel = await interaction.client.channels.fetch('976099718251831366');

					await interaction.followUp('Thank you for your suggestion!');
					const suggestionMsg = await suggestionChannel.send({ content: '@Developers', embeds: [embed] });
					suggestionMsg.react(normal.yes);
					suggestionMsg.react(normal.neutral);
					suggestionMsg.react(normal.no);
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