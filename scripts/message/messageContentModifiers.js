module.exports = {
	async execute(message, embed) {
		if (message.attachments.size > 0) {
			if (message.attachments.size > 1) await message.reply('Due to Discord Embed limitations, only the first attachment will be sent.');
			embed.setImage(message.attachments.first().url);
		}
	},
};