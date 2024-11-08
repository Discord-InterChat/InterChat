import BasePrefixCommand, { CommandData } from '#main/core/BasePrefixCommand.js';
import { Message } from 'discord.js';

export default class BlacklistPrefixCommand extends BasePrefixCommand {
  public readonly data: CommandData = {
    name: 'disconnect',
    description: 'Connect to a random chat group',
    category: 'Moderation',
    usage: 'connect',
    examples: ['disconnect', 'dc', 'hangup'],
    aliases: ['hangup', 'dc', 'disconn'],
    dbPermission: false,
    requiredArgs: 0,
  };

  protected async run(message: Message<true>) {
    const { chatService } = message.client;
    const alreadyConnected = await chatService.getChannelGroup(message.channelId);
    if (!alreadyConnected) {
      await message.reply('This channel is not connected to a chat group!');
      return;
    }

    await chatService.disconnectChannel(message.channelId);
    await message.reply('Disconnected from chat group!');
  }
}
