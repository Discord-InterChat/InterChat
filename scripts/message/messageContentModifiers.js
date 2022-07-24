const logger = require('../../logger');

module.exports = {
	async execute(message, embed) {

		if (message.attachments.size > 0) {
			if (message.attachments.size > 1) await message.reply('Due to Discord Embed limitations, only the first attachment will be sent.');
			// .attachment should create a new link to image instead of using the deleted image url [review]
			embed.setImage(message.attachments.first().proxyURL);
		}

		// eslint-disable-next-line no-useless-escape
		const regex = /(?:(?:(?:[A-Za-z]{3,9}:(?:\/\/)?)(?:[-;:&=\+\$,\w]+@)?[A-Za-z0-9.-]+|(?:www.|[-;:&=\+\$,\w]+@)[A-Za-z0-9.-]+)(?:(?:\/[\+~%\/.\w-_]*)?\??(?:[-\+=&;%@.\w_]*)#?(?:[\w]*))?)(?:\.jpg|\.gif|\.png|\.webp)/;
		const match = message.content.match(regex);

		if (match) {
			embed.setImage(match[0]);
			try {
				embed.setFields([
					{ name: 'Message ', value: message.content.replace(match[0], '\u200B').trim() },
				]);
			}
			catch (e) {
				logger.error(e);
			}
		}


		const tenorRegex = /https:\/\/tenor\.com\/view\/.*-(\d+)/;
		const isTenor = tenorRegex.test(message.content); // pretty much the same thing .match() does but returns boolian
		if (isTenor) {
			const fetch = require('node-fetch');

			const gif = message.content.match(tenorRegex);
			const n = gif[0].split('-');
			const id = n[n.length - 1];
			const api = `https://g.tenor.com/v1/gifs?ids=${id}&key=957PTLK8CNC0`;

			fetch(api)
				.then(res => res.json())
				.then(json => embed.setImage(json.results[0].media[0].gif.url))
				.then(embed.setFields([{ name: 'Message ', value: message.content.replace(gif[0], '\u200B').trim() }]))
				.catch(logger.error);
		}

	},
};