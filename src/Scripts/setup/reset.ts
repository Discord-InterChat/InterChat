import { PrismaClient } from '@prisma/client';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChatInputCommandInteraction, ComponentType } from 'discord.js';
import { NetworkManager } from '../../Structures/network';

export = {
	async execute(interaction: ChatInputCommandInteraction, db: PrismaClient) {
		const network = new NetworkManager();

		const { normal, icons } = interaction.client.emoji;

		if (!await db.setup?.findFirst({ where: { guildId: interaction.guildId?.toString() } })) {
			return interaction.reply(`${normal.no} This server is not setup yet.`);
		}

		const choiceButtons = new ActionRowBuilder<ButtonBuilder>().addComponents([
			new ButtonBuilder().setCustomId('yes').setLabel('Yes').setStyle(ButtonStyle.Success),
			new ButtonBuilder().setCustomId('no').setLabel('No').setStyle(ButtonStyle.Danger),
		]);

		const resetConfirmMsg = await interaction.reply({
			content: `${icons.info} Are you sure? You will have to re-setup to use the network again! All setup data will be lost.`,
			components: [choiceButtons],
		});


		const resetCollector = resetConfirmMsg.createMessageComponentCollector({
			filter: (m) => m.user.id == interaction.user.id,
			componentType: ComponentType.Button,
			idle: 10_000,
			max: 1,
		});

		// Creating collector for yes/no button
		resetCollector.on('collect', async (collected) => {
			if (collected.customId !== 'yes') {
				collected.update({
					content: `${normal.no} Cancelled.`,
					components: [],
				});
				return;
			}

			await db.setup?.deleteMany({ where: { guildId: interaction.guild?.id } });
			await network.disconnect(interaction.guildId);

			collected.update({
				content: `${normal.yes} Successfully reset.`,
				components: [],
			});

		});
	},
};