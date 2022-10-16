import fetch from 'node-fetch';
import logger from '../../Utils/logger';
import { AttachmentBuilder, EmbedBuilder, Message } from 'discord.js';
import 'dotenv/config';

export default {
	async attachmentModifiers(message: Message, embed: EmbedBuilder) {
		if (message.attachments.size > 1) {
			await message.reply('Due to Discord\'s Embed limitations, only the first attachment will be sent.');
		}

		if (message.attachments.size > 0) {
			message.channel.send('Warn: Sending images directly is currently experimental, so it might take a few seconds for chatbot to send images!');

			const attachment = message.attachments.first();
			const extension = attachment?.contentType?.split('/')[1];
			const newAttachment = new AttachmentBuilder(attachment?.url as string, { name: `attachment.${extension}` });
			embed.setImage(`attachment://${newAttachment.name}`);

			return newAttachment;
		}
	},

	async execute(message: Message, embed: EmbedBuilder) {
		// eslint-disable-next-line no-useless-escape
		const regex = /(?:(?:(?:[A-Za-z]{3,9}:(?:\/\/)?)(?:[-;:&=\+\$,\w]+@)?[A-Za-z0-9.-]+|(?:www.|[-;:&=\+\$,\w]+@)[A-Za-z0-9.-]+)(?:(?:\/[\+~%\/.\w-_]*)?\??(?:[-\+=&;%@.\w_]*)#?(?:[\w]*))?)(?:\.jpg|\.jpeg|\.gif|\.png|\.webp)/;
		const match = message.content.match(regex);

		if (message.reference) {
			const referredMessage = await message.fetchReference();
			if (referredMessage.author.id === message.client.user.id
				&& referredMessage.embeds[0]
				&& referredMessage.embeds[0].fields?.length > 0
			) {
				message.content = `> ${referredMessage.embeds[0].fields[0].value}\n${message.content}`;
				embed.setFields({ name: `Reply to ${referredMessage.author.tag}`, value: message.content });
			}
		}

		if (match) {
			embed.setImage(match[0]);
			try {
				embed.setFields([{ name: 'Message ', value: message.content.replace(match[0], '\u200B').trim() }]);
			}
			catch (e) {
				logger.error(e);
			}
		}

		const tenorRegex = /https:\/\/tenor\.com\/view\/.*-(\d+)/;
		const gifMatch = message.content.match(tenorRegex);

		if (gifMatch) {
			const n = gifMatch[0].split('-');
			const id = n[n.length - 1];
			const api = `https://g.tenor.com/v1/gifs?ids=${id}&key=${process.env.TENOR_KEY}`;

			fetch(api)
				.then((res) => res.json())
				.then((json) => {
					embed.setImage(json.results[0].media[0].gif.url);
					embed.setFields([{
						name: 'Message ',
						value: message.content.replace(gifMatch[0], '\u200B').trim(),
					}]);
				})
				.catch(logger.error);
		}
	},
};
