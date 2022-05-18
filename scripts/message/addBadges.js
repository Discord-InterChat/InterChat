module.exports = {
	async execute(message, database, embed) {
		const badges = await database.collection('userBadges').findOne({ userId: message.author.id });

		if (!badges) return;

		if (badges.badges.length > 0) {
			let badgeString = '';
			for (const badge of badges.badges) {
				if (badge === 'Developer') {
					badgeString += '<a:botdev_shine:772392715287134208> ';
				}
				else if (badge === 'Staff') {
					badgeString += '<a:staff:789764656549068820> ';
				}
				else if (badge === 'Premium') {
					badgeString += '<a:partnershine:772393323729649664> ';
				}
			}
			embed.setTitle(badgeString.slice(0, -1));
		}
	},
};