module.exports = {
	async execute(message) {
		/*
        FIXME: Make a better spam filter, this makes it slow
		// db for anti-spam
		const spamcollection = database.collection('message');

		const messageid = message.id;
		const userid = message.author.id;
		const usermessages = await spamcollection.find({ 'user.id': userid }).toArray();

		spamcollection.insertOne({
			user: {
				name: message.author.tag,
				id: message.author.id,
			},
			message: {
				id: message.id,
				content: message.content,
			},
			channel: {
				name: message.channel.name,
				id: message.id,
			},
			guild: {
				name: message.guild.name,
				id: message.guild.id,
			},
			timestamp: message.createdTimestamp,
		}).then(() => setInterval(() => { spamcollection.deleteOne({ 'message.id': messageid }); }, 3000));

		if (usermessages.length > 1) {
			return message.react(emoji.normal.no).catch(() => {return;});
		}

		if (usermessages.length > 6) {
			message.channel.send(emoji.icons.exclamation + ' **I have disconnected this channel from the network as I have detected heavy spam.**');
			return connectedList.deleteOne({ channelId: message.channel.id });
		} */
	},
};