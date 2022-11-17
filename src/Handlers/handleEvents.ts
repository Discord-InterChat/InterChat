import { Client } from 'discord.js';
import fs from 'fs';
import { join } from 'path';

export async function loadEvents(client: Client) {
	const eventFiles = fs.readdirSync(join(__dirname, '..', 'Events')).filter((file: string) => file.endsWith('.js'));

	for (const eventFile of eventFiles) {
		const event = await import(`../Events/${eventFile}`);

		if (event.once) {
			client.once(event.default.name, (...args) => event.default.execute(...args, client));
		}
		else {
			client.on(event.default.name, (...args) => event.default.execute(...args, client));
		}
	}
}
