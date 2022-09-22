import { Client } from 'discord.js';
import fs from 'fs';
import { join } from 'path';

export async function loadCommands(client: Client) {
	fs.readdirSync(join(__dirname, '..', 'Commands')).forEach(async (dir: string) => {
		if (fs.statSync(join(__dirname, '..', 'Commands', dir)).isDirectory()) {
			const commandFiles = fs.readdirSync(join(__dirname, '..', 'Commands', dir)).filter((file: string) => file.endsWith('.js'));
			for (const commandFile of commandFiles) {
				const command = await import(`../Commands/${dir}/${commandFile}`);

				client.commands.set(command.default.data.name, command.default);

			}

			// loading the help command
			const IgnoredDirs = ['Developer', 'Staff', 'TopGG'];
			if (IgnoredDirs.includes(dir)) return;

			const cmds = commandFiles.map(async (command: string) => {
				const file = await import(`../Commands/${dir}/${command}`);

				const name = file.default.data.name || 'No name';

				return `\`${name}\``;
			});

			Promise.all(cmds).then((cmd: string[]) => {
				client.help.push({
					name: dir,
					value: cmds.length === 0 ? 'No commands' : cmd.join(', '),
				});
			});
		}
	});
}