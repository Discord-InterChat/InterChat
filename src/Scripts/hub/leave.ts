import { ChatInputCommandInteraction } from 'discord.js';
import reset from '../network/reset';

export async function execute(interaction: ChatInputCommandInteraction, channelId: string) {
  await reset.execute(interaction, channelId);
}