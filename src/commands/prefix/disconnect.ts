import BasePrefixCommand, { CommandData } from '#main/core/BasePrefixCommand.js';
import { emojis } from '#main/utils/Constants.js';
import { Message } from 'discord.js';

export default class BlacklistPrefixCommand extends BasePrefixCommand {
  public readonly data: CommandData = {
    name: 'disconnect',
    description: 'Disconnect from current lobby',
    category: 'Moderation',
    usage: 'disconnect',
    examples: ['leavelobby', 'll', 'disconnect', 'dc', 'hangup'],
    aliases: ['hangup', 'dc', 'disconn', 'leave'],
    dbPermission: false,
    requiredArgs: 0,
  };

  protected async run(message: Message<true>) {
    const { lobbyService } = message.client;
    const alreadyConnected = await lobbyService.getChannelLobby(message.channelId);

    if (alreadyConnected) {
      await lobbyService.disconnectChannel(message.channelId);

    }
    else {
      const poolInfo = await lobbyService.getPoolInfo(message.channelId);
      if (!poolInfo.position) {
        await message.reply(`${emojis.no} This channel is not connected to a lobby!`);
        return;
      }

      await lobbyService.removeFromPoolByChannelId(message.channelId);
    }

    await message.reply(`${emojis.disconnect} You have disconnected from the lobby.`);
  }
}
