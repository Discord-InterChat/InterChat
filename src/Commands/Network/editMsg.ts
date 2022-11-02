import { ContextMenuCommandBuilder, MessageContextMenuCommandInteraction, ApplicationCommandType, ModalBuilder, ActionRowBuilder, TextInputBuilder, TextInputStyle, ChannelType, WebhookClient } from 'discord.js';
import { getDb, constants } from '../../Utils/functions/utils';
import { messageData, setupDocument } from '../../Utils/typings/types';
import logger from '../../Utils/logger';
import wordFiler from '../../Utils/functions/wordFilter';
import { Collection } from 'mongodb';


export default {
	data: new ContextMenuCommandBuilder()
		.setName('Edit Message')
		.setType(ApplicationCommandType.Message),

	/** Edit messages throughout the network *(partially works for compact mode) */
	async execute(interaction: MessageContextMenuCommandInteraction) {
		const target = interaction.targetMessage;

		if (!await constants.topgg.hasVoted(interaction.user.id)) {
			interaction.reply({
				content: `${interaction.client.emoji.normal.no} You must [vote](https://top.gg/bot/769921109209907241/vote) to use this command.`,
				ephemeral: true,
			});
			return;
		}

		const db = getDb();
		const messageInDb = await db?.collection('messageData').findOne({ channelAndMessageIds: { $elemMatch: { messageId: target.id } } }) as messageData | undefined;
		const setupList = db?.collection('setup') as Collection<setupDocument>;

		if (!messageInDb || messageInDb.expired) {
			interaction.reply({
				content: 'This message has expired :(',
				ephemeral: true,
			});
			return;
		}


		if (interaction.user.id != messageInDb.authorId) {
			interaction.reply({ content: 'You are not the author of this message.', ephemeral: true });
			return;
		}

		const replyRegex = /> .*/g;
		const placeholder = target.embeds[0]?.fields[0]?.value || target.content.replace(`**${interaction.user.tag}:**`, '');

		const modal = new ModalBuilder()
			.setCustomId(interaction.id)
			.setTitle('Edit Message')
			.addComponents(
				new ActionRowBuilder<TextInputBuilder>().addComponents(
					new TextInputBuilder()
						.setRequired(true)
						.setCustomId('editMessage')
						.setStyle(TextInputStyle.Paragraph)
						.setLabel('Please enter your new message.')
						.setValue(placeholder.replace(replyRegex, '').trim())
						.setMaxLength(950),
				),
			);

		await interaction.showModal(modal);

		// get the new message from the user via the modal
		interaction.awaitModalSubmit({ filter: (i) => i.user.id === interaction.user.id && i.customId === modal.data.custom_id, time: 30_000 })
			.then(i => {
				const editMessage = wordFiler.censor(i.fields.getTextInputValue('editMessage'));

				let targetEmbed = target.embeds[0]?.toJSON();
				let compactMsg: string;
				let compactWebhookMsg: string;

				if (targetEmbed?.fields) {
					// the message being replied to
					const targetRef = targetEmbed.fields[0].value.match(replyRegex)?.at(0);

					targetEmbed.fields[0].value = targetRef ? `${targetRef}\n${editMessage}` : editMessage;
					targetEmbed.timestamp = new Date().toISOString();
				}


				// loop through all channels and fetch the messages to edit
				// and edit each one as you go
				if (messageInDb.channelAndMessageIds) {
					messageInDb.channelAndMessageIds.forEach(async (element) => {
						interaction.client.channels.fetch(element.channelId)
							.then(async channel => {
								if (!channel?.isTextBased()) return;
								const channelSetup = await setupList?.findOne({ 'channel.id': channel.id });

								// NOTE: This will error if user tries to edit compact message after disabling compact mode in setup
								if (targetEmbed && !channelSetup?.compact && channelSetup?.webhook) {
									const webhookEmbed = targetEmbed;
									webhookEmbed.author = undefined;

									const webhook = new WebhookClient({ id: channelSetup?.webhook.id, token: channelSetup?.webhook.token });
									webhook.editMessage(element.messageId, { embeds: [targetEmbed] }).catch(e => logger.error('Editing Webhook: [embeds]', e));
									return;

								}

								channel.messages.fetch(element.messageId)
									.then(async message => {
										// First message is in compact mode but this one is not
										// then store this as targetEmbed and use that to edit the other embeded messages
										if (!channelSetup?.compact && !targetEmbed) {
											targetEmbed = message.embeds[0]?.toJSON();
											if (targetEmbed?.fields) targetEmbed.fields[0].value = editMessage;
										}

										if (channelSetup?.compact && !compactMsg) {
											const temp = message.content.match(replyRegex);
											compactMsg = temp ? `${temp.at(0)}\n**${interaction.user.tag}:** ${editMessage}` : `**${interaction.user.tag}:** ${editMessage}`;
											compactWebhookMsg = temp ? `${temp.at(0)}\n${editMessage}` : editMessage;
										}

										if (channelSetup?.webhook && channelSetup.compact) {
											const webhook = new WebhookClient({ id: channelSetup.webhook.id, token: channelSetup.webhook.token });
											try {
												await webhook.editMessage(element.messageId, { content: compactWebhookMsg });
											}
											catch (e) {
												logger.error('Editing Webhook [compact]', e);
											}
										}

										else if (channelSetup?.webhook && !channelSetup.compact) {
											const webhook = new WebhookClient({ id: channelSetup.webhook.id, token: channelSetup.webhook.token });
											webhook.editMessage(element.messageId, { embeds: [targetEmbed] });
										}

										else if (channelSetup?.compact) {
											message.edit(compactMsg);
										}

										else {
											message.edit({ embeds: [targetEmbed] });
										}

									}).catch(logger.error);
							}).catch(logger.error);
					});
				}
				i.reply({ content: `${interaction.client.emoji.normal.yes} Message Edited.`, ephemeral: true });
			})
			.catch(() => null);
	},
};