module.exports = {
	async execute(message, database, embed) {
		const badges = await database.collection('userBadges').findOne({ userId: message.author.id });

		if (!badges) return;

		if (badges.badges.length > 0) {
			let badgeString = '';
			for (const badge of badges.badges) {
				if (badge === 'Developer') {
					badgeString += '<a:botdev_shine:772392715287134208>\u200B ';
				}
				else if (badge === 'Staff') {
					badgeString += '<:DiscordStaff:910149173146443876>\u200B ';
				}
				else if (badge === 'Premium') {
					badgeString += '<:modbutbetter:918511698367901707>\u200B ';
				}
			}
			embed.setTitle(badgeString.slice(0, -1));
		}
	},
};