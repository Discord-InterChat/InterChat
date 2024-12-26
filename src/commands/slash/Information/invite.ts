import { ChatInputCommandInteraction } from 'discord.js';
import BaseCommand from '#main/core/BaseCommand.js';
import Constants from '#utils/Constants.js';
import { t } from '#utils/Locale.js';

export default class Invite extends BaseCommand {
  readonly data = {
    name: 'invite',
    description: '👋 Invite me to your server!',
  };
  async execute(interaction: ChatInputCommandInteraction) {
    const { userManager } = interaction.client;
    const locale = await userManager.getUserLocale(interaction.user.id);
    await interaction.reply({
      content: t('invite', locale, {
        support: Constants.Links.SupportInvite,
        invite: Constants.Links.AppDirectory,
        invite_emoji: this.getEmoji('plus_icon'),
        support_emoji: this.getEmoji('code_icon'),
      }),
    });
  }
}
