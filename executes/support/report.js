const { MessageActionRow, MessageButton, MessageEmbed } = require('discord.js');
const { colors } = require('../../utils');

module.exports = {
	async execute(interaction) {
		const row = new MessageActionRow()
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
		await interaction.reply({ content: 'Do you want to send this report to the ChatBot HQ Server?', components: [row] });
		const message = await interaction.fetchReply();
		const collector = message.createMessageComponentCollector({ componentType: 'BUTTON', time: 10000, idle: 10000, max: 1 });

		collector.on('collect', async i => {
			if (i.user.id === interaction.user.id) {
				if (i.customId === 'yes') {
					const type = interaction.options.getString('type');
					const report = interaction.options.getString('report');
					const embed = new MessageEmbed()
						.setTitle('New Report')
						.setDescription(`**Type: ${type}**\n\n` + report)
						.setAuthor(`Reported By: ${interaction.member.user.tag}`, interaction.member.user.avatarURL({ dynamic: true }))
						.setFooter(`From Server: ${interaction.guild.name}`, interaction.guild.iconURL({ dynamic: true }))
						.setTimestamp()
						.setColor(colors());

					const reportChannel = await interaction.client.channels.fetch('821610981155012628');

					await interaction.followUp('Thank you for your report!');
					await reportChannel.send({ content: '@Developers', embeds: [embed] });
				}
				else {
					await interaction.followUp('Ok, discarding report.');
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