import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  OAuth2Scopes,
} from 'discord.js';
import BaseCommand from '../../BaseCommand.js';
import { URLs, emojis } from '../../../utils/Constants.js';
import { stripIndents } from 'common-tags';

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
      content: stripIndents`
      Thank you for choosing to invite InterChat. Simply click the button below to invite me!

      - **__Support Server__:** ${URLs.SUPPORT_INVITE}`,
      components: [InviteButton],
    });
  }
}
