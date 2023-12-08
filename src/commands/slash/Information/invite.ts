import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  OAuth2Scopes,
} from 'discord.js';
import BaseCommand from '../../BaseCommand.js';
import { LINKS, emojis } from '../../../utils/Constants.js';
import { __ } from '../../../utils/Locale.js';

export default class Invite extends BaseCommand {
  readonly data = {
    name: 'invite',
    description: 'Invite me to your server!',
  };
  async execute(interaction: ChatInputCommandInteraction) {
    const inviteLink = interaction.client.generateInvite({
      scopes: [OAuth2Scopes.Bot, OAuth2Scopes.ApplicationsCommands],
      // FIXME: Update the permissions every time you update invite
      permissions: 292662144192n,
    });

    const InviteButton = new ActionRowBuilder<ButtonBuilder>().addComponents([
      new ButtonBuilder()
        .setLabel('Invite Me!')
        .setURL(inviteLink)
        .setStyle(ButtonStyle.Link)
        .setEmoji(emojis.invite)
        .setDisabled(false),
    ]);
    await interaction.reply({
      content: __(
        { phrase: 'invite', locale: interaction.user.locale },
        { support: LINKS.SUPPORT_INVITE },
      ),
      components: [InviteButton],
    });
  }
}
