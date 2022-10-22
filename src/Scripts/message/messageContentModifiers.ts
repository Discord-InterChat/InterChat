import fetch from 'node-fetch';
import logger from '../../Utils/logger';
import { AttachmentBuilder, EmbedBuilder, Message } from 'discord.js';
import wordFilter from '../../Utils/functions/wordFilter';
import { MessageInterface } from '../../Events/messageCreate';
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


		const imageURLRegex = /(?:(?:(?:[A-Za-z]{3,9}:(?:\/\/)?)(?:[-;:&=+$,\w]+@)?[A-Za-z0-9.-]+|(?:www.|[-;:&=+$,\w]+@)[A-Za-z0-9.-]+)(?:(?:\/[+~%/.\w-_]*)?\??(?:[-+=&;%@.\w_]*)#?(?:[\w]*))?)(?:\.jpg|\.jpeg|\.gif|\.png|\.webp)/;
		const URLMatch = message.content.match(imageURLRegex);

		if (URLMatch) {
			embed.setImage(URLMatch[0]);
			try {
				embed.setFields([{ name: 'Message', value: message.content.replace(URLMatch[0], '\u200B').trim() }]);
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
			const gifJSON = await (await fetch(api)).json();

			embed
				.setImage(gifJSON.results[0].media[0].gif.url)
				.setFields([{
					name: 'Message',
					value: message.content.replace(gifMatch[0], '\u200B').trim(),
				}]);
		}
	},

	async profanityCensor(embed: EmbedBuilder, message: MessageInterface) {
		// check if message contains profanity and censor it if it does
		if (wordFilter.check(embed.data.fields?.at(0)?.value)) {
			embed.setFields({ name: 'Message', value: wordFilter.censor(String(embed.data.fields?.at(0)?.value)) });
		}

		if (wordFilter.check(message.compactMessage)) {
			message.compactMessage = wordFilter.censor(String(message.compactMessage));
		}
	},
};
