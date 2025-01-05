import type { ChatInputCommandInteraction, GuildTextBasedChannel } from 'discord.js';
import { HubJoinService } from '#main/services/HubJoinService.js';
import HubCommand from './index.js';

export default class JoinSubCommand extends HubCommand {
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.inCachedGuild()) return;

    const hubInviteOrName =
      interaction.options.getString('invite') ?? interaction.options.getString('hub') ?? undefined;

    const channel = (interaction.options.getChannel('channel') ??
      interaction.channel) as GuildTextBasedChannel;
    const locale = await this.getLocale(interaction);

    // get random hub if no invite or name is provided
    const hubJoinService = new HubJoinService(interaction, locale);

    if (hubInviteOrName) await hubJoinService.joinHub(channel, hubInviteOrName);
    else await hubJoinService.joinRandomHub(channel);
  }
}
