const fs = require('fs');

module.exports.loadEvents = async (client, reload = false) => {

	// for reload command to work properly
	if (client.listenerCount('ready') > 0) client.removeAllListeners('ready');

	const eventFiles = fs.readdirSync('src/events').filter((file) => file.endsWith('.js'));

	for (const eventFile of eventFiles) {
		if (reload === true) delete require.cache[require.resolve(`../events/${eventFile}`)];

		const event = require(`../events/${eventFile}`);

		if (event.once) {
			client.once(event.name, (...args) => event.execute(...args, client));
		}
		else {
			client.on(event.name, (...args) => event.execute(...args, client));
		}
	}
};