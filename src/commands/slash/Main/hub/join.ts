import { HubJoinService } from '#main/modules/HubJoinService.js';
import { ChannelType, ChatInputCommandInteraction } from 'discord.js';
import HubCommand from './index.js';

export default class JoinSubCommand extends HubCommand {
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.inCachedGuild()) return;

    const hubInviteOrName =
      interaction.options.getString('invite') ?? interaction.options.getString('hub') ?? undefined;

    const channel = interaction.options.getChannel('channel', true, [
      ChannelType.GuildText,
      ChannelType.PublicThread,
      ChannelType.PrivateThread,
    ]);
    const locale = await this.getLocale(interaction);

    await new HubJoinService(interaction, locale).joinHub(channel, hubInviteOrName);
  }
}
