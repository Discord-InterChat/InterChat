const discord = require('discord.js');
const dotenv = require('dotenv');
const fs = require('fs');
const { MongoClient } = require('mongodb');

dotenv.config();

const client = new discord.Client({
	intents: [
		discord.Intents.FLAGS.GUILDS,
		discord.Intents.FLAGS.GUILD_MESSAGES,
		discord.Intents.FLAGS.GUILD_MESSAGE_REACTIONS,
		discord.Intents.FLAGS.DIRECT_MESSAGES,
		discord.Intents.FLAGS.DIRECT_MESSAGE_REACTIONS,
	],
});

client.description = 'A growing discord bot which provides inter-server chat!';
client.commands = new discord.Collection();


fs.readdirSync('./commands').forEach((dir) => {
	if (fs.statSync(`./commands/${dir}`).isDirectory()) {
		const commandFiles = fs.readdirSync(`./commands/${dir}`).filter(file => file.endsWith('.js'));
		for (const commandFile of commandFiles) {
			const command = require(`./commands/${dir}/${commandFile}`);
			client.commands.set(command.data.name, command);
		}
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

// Create MongoDB Client and export it
const uri = process.env.MONGODB_URI;
const dbClient = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });
module.exports.dbClient = dbClient;


client.login(process.env.TOKEN);