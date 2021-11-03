const mongoUtil = require('../mongoUtil');

module.exports = {
	name: 'messageCreate',
	async execute(message) {
		if (message.author.bot) return;

		if (message.content.startsWith('c!help')) {
			await message.reply('ChatBot does not respond to any commands with the prefix `c!` anymore since we have switched to slash commands! Please type / and check out the list of commands!');
			return;
		}

		const database = mongoUtil.getDb();
		const connectedList = database.collection('connectedList');

		const channelInNetwork = await connectedList.findOne({ channel_id: message.channel.id });

		if (channelInNetwork) {
			// TODO: Implement this
		}
		else {
			return;
		}
	},
};