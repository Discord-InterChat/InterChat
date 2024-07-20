import { ChatInputCommandInteraction } from 'discord.js';
import BaseCommand from '../../../core/BaseCommand.js';
import { LINKS, emojis } from '../../../utils/Constants.js';
import { t } from '../../../utils/Locale.js';
import { getUserLocale } from '#main/utils/Utils.js';

export default class Invite extends BaseCommand {
  readonly data = {
    name: 'invite',
    description: 'Invite me to your server!',
  };
  async execute(interaction: ChatInputCommandInteraction) {
    const locale = await getUserLocale(interaction.user.id);
    await interaction.reply({
      content: t(
        { phrase: 'invite', locale },
        {
          support: LINKS.SUPPORT_INVITE,
          invite: LINKS.APP_DIRECTORY,
          invite_emoji: emojis.add_icon,
          support_emoji: emojis.code_icon,
        },
      ),
    });
  }
}
