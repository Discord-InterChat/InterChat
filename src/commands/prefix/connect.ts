import BasePrefixCommand, { CommandData } from '#main/core/BasePrefixCommand.js';
import { msToReadable } from '#main/utils/Utils.js';
import { stripIndents } from 'common-tags';
import { Message, PermissionsBitField } from 'discord.js';

export default class BlacklistPrefixCommand extends BasePrefixCommand {
  public readonly data: CommandData = {
    name: 'connect',
    description: 'Connect to a random lobby',
    category: 'Moderation',
    usage: 'connect',
    examples: ['c', 'call'],
    aliases: ['call', 'c', 'conn', 'joinlobby', 'jl'],
    requiredBotPermissions: new PermissionsBitField(['SendMessages', 'EmbedLinks', 'ReadMessageHistory']),
    dbPermission: false,
    requiredArgs: 0,
  };

  protected async run(message: Message<true>) {
    // TODO: uncomment this after final release
    // const voteLimiter = new VoteLimitManager('editMsg', message.author.id, message.client.userManager);

    // if (await voteLimiter.hasExceededLimit()) {
    //   await message.reply({
    //     content: `${emojis.topggSparkles} Daily limit for lobbies reached. [Vote on top.gg](${Constants.Links.Vote}) to chat non-stop for the next 12 hours! Or join a [permanent hub](https://interchat.fun/hubs) to chat without voting.`,
    //   });
    //   return;
    // }

    // check if already connected
    const { lobbyService } = message.client;
    const alreadyConnected = await lobbyService.getChannelLobby(message.channelId);
    if (alreadyConnected) {
      await message.reply('This server is already connected to a lobby!');
      return;
    }

    const { queued, lobby } = await lobbyService.connectChannel(message.guildId, message.channelId);

    if (lobby) {
      await message.reply(stripIndents`
      Connected to a lobby with ${lobby.connections.length} server(s)!
      Activity level: ${lobby.activityLevel} messages/5min
      -# Messages in this channel will be shared with other servers.
    `);
    }
    else if (queued) {
      const info = await lobbyService.getPoolInfo(message.channelId);
      await message.channel.send(stripIndents`
        Finding a lobby for this server... Hang tight!
        -# You will be notified once a lobby is found. Estimated wait time: ${info.estimatedWaitTime ? msToReadable(info.estimatedWaitTime) : 'now'}.
      `);
    }
  }
}
