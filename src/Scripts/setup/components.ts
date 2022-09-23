import { ChatInputCommandInteraction, ButtonBuilder, ActionRowBuilder, ButtonStyle } from 'discord.js';
import { Collection } from 'mongodb';
import { Embeds } from '../../Commands/Main/setup';
import emoji from '../../Utils/emoji.json';

export = {
	async execute(interaction: ChatInputCommandInteraction, collection: Collection | undefined, embedGen: Embeds, connectedList: Collection | undefined) {
		const InitialMessage = await interaction.fetchReply();
		const ChoiceButtons = new ActionRowBuilder<ButtonBuilder>().addComponents([
			new ButtonBuilder().setCustomId('yes').setLabel('Yes').setStyle(ButtonStyle.Success),
			new ButtonBuilder().setCustomId('no').setLabel('No').setStyle(ButtonStyle.Danger),
		]);


		const guildConnected = await connectedList?.findOne({ guildId: interaction.guildId });

		// Create action row collectors
		const setupCollector = InitialMessage.createMessageComponentCollector({
			filter: m => m.user.id == interaction.user.id,
			time: 60_000,
		});

		// Everything is in one collector since im lazy
		setupCollector.on('collect', async component => {
			if (component.isButton()) {
				switch (component.customId) {
				// TODO: Make network class to reconnect / disconnect / connect to network in Utils file.
				case 'reconnect':
					if (guildConnected) {
						// If guild is connected give them an option to choose a different channel to connect to. Or just make a different "Change"
						// button to switch network channels.
						component.reply({ content: 'Guild already connected!', ephemeral: true });
						return;
					}
					component.reply({ content: 'WIP!' });
					break;


				case 'disconnect':
					connectedList?.deleteOne({ serverId: interaction.guild?.id })
						.then(async () => {
							component.reply({ content: 'Disconnected!', ephemeral: true });
							interaction.editReply({ embeds: [await embedGen.default()] });
						})
						.catch(() => component.followUp({ content: 'An Error Occured! Report a bug using the `/support report` command.', ephemeral: true }));
					break;

				case 'reset': {
					try {
						const resetConfirmMsg = await interaction.followUp({
							content: `${emoji.icons.info} Are you sure? This will disconnect all connected channels and reset the setup. The channel itself will remain though.`,
							components: [ChoiceButtons],
						});
						component.update({ components: [] });

						const resetCollector = resetConfirmMsg.createMessageComponentCollector({
							filter: (m) => m.user.id == interaction.user.id,
							idle: 10_000,
							max: 1,
						});

						// Creating collector for yes/no button
						resetCollector.on('collect', async (collected) => {
							if (collected.customId === 'yes') {
								await collection?.deleteOne({ 'guild.id': interaction.guild?.id });
								await connectedList?.deleteOne({ serverId: interaction.guild?.id });
								collected.update({
									content: `${emoji.normal.yes} Successfully reset.`,
									components: [],
								});
							}
							else {
								collected.message.delete();
							}
							return;
						});
					}
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					catch (e: any) {
						component.update({
							content: `${emoji.icons.exclamation} ${e.message}!`,
							embeds: [],
							components: [],
						});
					}
				}
					break;

				default:
					break;
				}
			}

			// Reference multiple select menus with its 'value' (values[0])
			if (component.isSelectMenu()) {
				switch (component.customId) {
				case 'customize': {
					// get the latest db updates
					const guildInDB = await collection?.findOne({ 'guild.id': interaction.guild?.id });

					if (component.values[0] === 'compact') {
						await collection?.updateOne({ 'guild.id': interaction.guild?.id },
							{ $set: { 'date.timestamp': Math.round(new Date().getTime() / 1000), compact: !guildInDB?.compact } });
					}

					if (component.values[0] === 'profanity_toggle') {
						await collection?.updateOne({ 'guild.id': interaction.guild?.id },
							{ $set: { 'date.timestamp': Math.round(new Date().getTime() / 1000), profFilter: !guildInDB?.profFilter } });
					}
					component.update({ embeds: [await embedGen.default()] });
				}
				}
			}
		});

		setupCollector.on('end', () => {
			interaction.editReply({ components: [] });
			return;
		});

	},
};

