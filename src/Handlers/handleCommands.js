const fs = require('fs');

module.exports.loadCommands = async (client, reload = false) => {
	fs.readdirSync('src/commands').forEach((dir) => {
		if (fs.statSync(`src/commands/${dir}`).isDirectory()) {
			const commandFiles = fs.readdirSync(`src/commands/${dir}`).filter(file => file.endsWith('.js'));
			for (const commandFile of commandFiles) {
				// if you ever decide to create a reload feature (like dpy cogs)
				if (reload === true) delete require.cache[require.resolve(`../commands/${dir}/${commandFile}`)];

				const command = require(`../commands/${dir}/${commandFile}`);
				client.commands.set(command.data.name, command);
			}

			const IgnoredDirs = ['Developer', 'TopGG'];
			if (IgnoredDirs.includes(dir)) return;

			const cmds = commandFiles.map((command) => {
				const file = require(`../commands/${dir}/${command}`);

				const name = file.data.name?.replace('.js', '') || 'No name';

				return `\`${name}\``;
			});


			client.help.push({
				name: dir,
				value: cmds.length === 0 ? 'No commands' : cmds.join(', '),
			});
		}
	});
};