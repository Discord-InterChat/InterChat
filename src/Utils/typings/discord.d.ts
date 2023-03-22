import discord from 'discord.js';
import EmojiIDs from '../../Utils/JSON/emoji.json';

type InterchatCommand = {
  developer?: boolean,
  staff?: boolean,
  description?: string | undefined
  directory: string,
  data: discord.SlashCommandBuilder | discord.ContextMenuCommandBuilder,
  execute: (interaction: discord.ChatInputCommandInteraction | discord.MessageContextMenuCommandInteraction) => unknown
  autocomplete?: (interaction: discord.AutocompleteInteraction) => unknown
}

declare module 'discord.js' {
  export interface Client {
    commands: discord.Collection<string, InterchatCommand>,
    description: string,
    version: string,
    emotes: typeof EmojiIDs,
    /* An invite link generated for the client */
    invite: string;
    sendInNetwork(message: string | MessageCreateOptions): Promise<void>;
  }
}
