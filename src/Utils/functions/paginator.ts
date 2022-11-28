import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, CommandInteraction, Message, ComponentType } from 'discord.js';

/**
 * @param pages - An array of embeds to be paginated
 * @param time - in milliseconds default is `60000ms`
 */
export async function paginate(interaction: CommandInteraction, pages: EmbedBuilder[],
	buttons =
	{
		back: interaction.client.emoji.icons.back,
		exit: interaction.client.emoji.icons.delete,
		next: interaction.client.emoji.icons.next,
	},
	time = 60000) {
	if (pages.length < 0 || time < 10000) throw new Error('Invalid Parameters');

	// eslint-disable-next-line prefer-const
	let index = 0, row = new ActionRowBuilder<ButtonBuilder>().addComponents([
		new ButtonBuilder().setEmoji(buttons.back).setCustomId('1').setStyle(ButtonStyle.Secondary).setDisabled(true),
		new ButtonBuilder().setEmoji(buttons.exit).setCustomId('3').setStyle(ButtonStyle.Danger),
		new ButtonBuilder().setEmoji(buttons.next).setCustomId('2').setStyle(ButtonStyle.Secondary).setDisabled(pages.length <= index + 1),
	]);

	let pagenumber = 0;
	try {
		pages[pagenumber].setFooter({ text: `Page ${pagenumber + 1} / ${pages.length}` });
	}
	catch {/**/}

	const data = {
		embeds: [pages[index]],
		components: [row],
		fetchReply: true,
	};
	const listMessage = interaction.replied ? await interaction.followUp(data) : await interaction.reply(data);

	const col = listMessage.createMessageComponentCollector({ filter: i => i.user.id === interaction.user.id, time, componentType: ComponentType.Button });

	col.on('collect', (i) => {
		if (i.customId === '1') {--pagenumber, index--;}
		else if (i.customId === '2') {pagenumber++, index++;}
		else {
			(listMessage as Message).edit({ components: [] });
			col.stop();
			return;
		}


		row.setComponents([
			new ButtonBuilder().setEmoji(buttons.back).setStyle(ButtonStyle.Secondary).setCustomId('1').setDisabled(index === 0),
			new ButtonBuilder().setEmoji(buttons.exit).setStyle(ButtonStyle.Danger).setCustomId('3'),
			new ButtonBuilder().setEmoji(buttons.next).setStyle(ButtonStyle.Secondary).setCustomId('2').setDisabled(index === pages.length - 1),
		]);

		try {pages[pagenumber].setFooter({ text: `Page ${pagenumber + 1} / ${pages.length}` });}
		catch {/**/}

		i.update({
			components: [row],
			embeds: [pages[index]],
		});
	});
}