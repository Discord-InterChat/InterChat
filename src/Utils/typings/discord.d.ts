import discord from 'discord.js';
import EmojiIDs from '../../Utils/JSON/emoji.json';

type commands = {
	developer?: boolean,
	staff?: boolean,
	description?: string | undefined
	data: discord.SlashCommandBuilder,
	execute: (interaction: discord.ChatInputCommandInteraction | discord.MessageContextMenuCommandInteraction) => unknown
	autocomplete?: (interaction: discord.AutocompleteInteraction) => unknown
}

declare module 'discord.js' {
    export interface Client {
		commands: discord.Collection<string, commands>,
		description: string,
		version: string,
		emoji: typeof EmojiIDs,
		help: Array<{name: string, value: string}>
		sendInNetwork(message: string): Promise<void>;
	}
}