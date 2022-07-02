const discord = require('discord.js');
const dotenv = require('dotenv');
const fs = require('fs');
const mongoUtil = require('./utils.js');
const logger = require('./logger');
dotenv.config();

// eslint-disable-next-line no-unused-vars
mongoUtil.connect((err, mongoClient) => {
	if (err) logger.error(err);
	logger.info('Connected to MongoDB');
});

const client = new discord.Client({
	ws: { properties: { browser: 'Discord iOS' } },
	/* removed unused intents for performance issues
		discord.Intents.FLAGS.DIRECT_MESSAGES,
		discord.Intents.FLAGS.DIRECT_MESSAGE_REACTIONS,
		discord.Intents.FLAGS.GUILD_MESSAGE_REACTIONS,
	*/
	intents: [
		discord.Intents.FLAGS.GUILDS,
		discord.Intents.FLAGS.GUILD_MESSAGES,
		discord.Intents.FLAGS.GUILD_MEMBERS,
	],
});

client.description = 'A growing discord bot which provides inter-server chat!';
client.commands = new discord.Collection();
client.version = require('./package.json').version;
client.help = [];
module.exports.client = client;
module.exports.discord = discord;

fs.readdirSync('./commands').forEach((dir) => {
	if (fs.statSync(`./commands/${dir}`).isDirectory()) {
		const commandFiles = fs.readdirSync(`./commands/${dir}`).filter(file => file.endsWith('.js'));
		for (const commandFile of commandFiles) {
			const command = require(`./commands/${dir}/${commandFile}`);
			client.commands.set(command.data.name, command);
		}
		if (dir === 'private' || dir === 'Testing') return;
		const cmds = commandFiles.map((command) => {
			const file = (require(`./commands/${dir}/${command}`));
			if (!file.data.name) return 'No name';

			const name = file.data.name.replace('.js', '');

			return `\`${name}\``;
		});
		const data = {
			name: dir,
			value: cmds.length === 0 ? 'No commands' : cmds.join(', '),
		};
		client.help.push(data);
	}
});


const eventFiles = fs.readdirSync('./events').filter((file) => file.endsWith('.js'));

for (const eventFile of eventFiles) {
	const event = require(`./events/${eventFile}`);

	if (event.once) {
		client.once(event.name, (...args) => event.execute(...args, client));
	}
	else {
		client.on(event.name, (...args) => event.execute(...args, client));
	}
}


async function deleteChan() {
	const database = mongoUtil.getDb();
	const connectedList = database.collection('connectedList');
	const channels = await connectedList.find().toArray();

	const channelsDelete = [];
	channels.forEach(async (v, i) => {
		let channel;

		try { channel = await client.channels.fetch(v.channelId); }
		catch (e) {
			if (e.message === 'Unknown Channel') channelsDelete.push(v.channelId);
			const deleteCursor = await connectedList.deleteMany({ channelId: { $in: channelsDelete } });
			logger.info(`Hourly db clearence: Deleted ${deleteCursor.deletedCount} channels from the connectedList database`);
		}
	});
}
setInterval(deleteChan, 60 * 60 * 1000);


process.on('uncaughtException', function(err) {
	logger.error('Excepton:', err);
});
process.on('unhandledRejection', function(err) {
	logger.error('Rejection:', err);
});

client.login(process.env.TOKEN);
/*
client.commands.filter(cmd => cmd.category).forEach(cmd => {})

client.help = () => {
	const dataArray = [];
	fs.readdirSync('./commands').forEach((dir) => {
		if (fs.statSync(`./commands/${dir}`).isDirectory()) {
			const commandFiles = fs.readdirSync(`./commands/${dir}`).filter(file => file.endsWith('.js'));

			const cmds = commandFiles.map((command) => {
				const file = (require(`./commands/${dir}/${command}`));
				if (!file.data.name) return 'No name';

				const name = file.data.name.replace('.js', '');

				return `\`${name}\``;
			});
			const data = {
				name: dir,
				value: cmds.length === 0 ? 'No commands' : cmds.join(', '),
			};
			dataArray.push(data);
		}
	});
	return dataArray;
}; */
