import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChatInputCommandInteraction } from 'discord.js';
import { Collection } from 'mongodb';
import { NetworkManager } from '../../Utils/functions/utils';

export = {
	async execute(interaction: ChatInputCommandInteraction, setupList: Collection | undefined) {
		const network = new NetworkManager();

		if (!await setupList?.findOne({ 'guild.id': interaction.guildId })) {
			return interaction.reply(`${interaction.client.emoji.normal.no} This server is not setup yet.`);
		}

		const choiceButtons = new ActionRowBuilder<ButtonBuilder>().addComponents([
			new ButtonBuilder().setCustomId('yes').setLabel('Yes').setStyle(ButtonStyle.Success),
			new ButtonBuilder().setCustomId('no').setLabel('No').setStyle(ButtonStyle.Danger),
		]);

		const resetConfirmMsg = await interaction.reply({
			content: `${interaction.client.emoji.icons.info} Are you sure? You will have to re-setup to use the network again! All setup data will be lost.`,
			components: [choiceButtons],
		});


		const resetCollector = resetConfirmMsg.createMessageComponentCollector({
			filter: (m) => m.user.id == interaction.user.id,
			idle: 10_000,
			max: 1,
		});

		// Creating collector for yes/no button
		resetCollector.on('collect', async (collected) => {
			if (collected.customId !== 'yes') return resetCollector.stop();

			await setupList?.deleteOne({ 'guild.id': interaction.guild?.id });
			await network.disconnect(interaction.guildId);

			collected.update({
				content: `${interaction.client.emoji.normal.yes} Successfully reset.`,
				components: [],
			});

		});

		resetCollector.on('end', () => {
			interaction.editReply({
				content: `${interaction.client.emoji.normal.no} Reset cancelled.`,
				components: [],
			});
		});
	},
};