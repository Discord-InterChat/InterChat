const { MessageButton, MessageEmbed, MessageActionRow } = require('discord.js');
const { colors } = require('../../utils');
const { normal } = require('../../emoji.json');

module.exports = {
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
		// TODO: Use modals to get suggestions? And add attachment option to slash command so they can send pictures!
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
						.setColor(colors());
					// FIXME: change channelId to cbhq later
					const suggestionChannel = await interaction.client.channels.fetch('908713477433073674');

					await interaction.followUp('Thank you for your suggestion!');
					const suggestionMsg = await suggestionChannel.send({ content: '<@&770256273488347176>', embeds: [embed] });
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