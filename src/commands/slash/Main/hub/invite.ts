import Constants, { emojis } from '#main/config/Constants.js';
import db from '#main/utils/Db.js';
import { t } from '#main/utils/Locale.js';
import Logger from '#main/utils/Logger.js';
import { captureException } from '@sentry/node';
import { CacheType, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import parse from 'parse-duration';
import HubCommand from './index.js';

export default class Invite extends HubCommand {
  readonly cooldown = 3000; // 3 seconds

  async execute(interaction: ChatInputCommandInteraction<CacheType>) {
    const subcommand = interaction.options.getSubcommand();

    const { userManager } = interaction.client;
    const locale = await userManager.getUserLocale(interaction.user.id);

    switch (subcommand) {
      case 'create': {
        const hubName = interaction.options.getString('hub', true);
        const expiryStr = interaction.options.getString('expiry');
        const duration = expiryStr ? parse(expiryStr) : undefined;
        const expires = new Date(Date.now() + (duration || 60 * 60 * 4000));

        const hubInDb = await db.hub.findFirst({
          where: {
            name: hubName,
            private: true,
            OR: [
              { ownerId: interaction.user.id },
              { moderators: { some: { userId: interaction.user.id, position: 'manager' } } },
            ],
          },
        });

        if (!hubInDb) {
          await this.replyEmbed(
            interaction,
            t({ phrase: 'hub.notFound_mod', locale }, { emoji: emojis.no }),
            { ephemeral: true },
          );
          return;
        }

        if (!Date.parse(expires.toString())) {
          await interaction.reply({
            content: `${emojis.no} Invalid Expiry Duration provided!`,
            ephemeral: true,
          });
          return;
        }

        const createdInvite = await db.hubInvite.create({
          data: {
            hub: { connect: { name: hubName } },
            expires,
          },
        });

        const embed = new EmbedBuilder()
          .setDescription(
            t(
              { phrase: 'hub.invite.create.success', locale },
              {
                inviteCode: createdInvite.code,
                docs_link: Constants.Links.Docs,
                expiry: `<t:${Math.round(createdInvite.expires.getTime() / 1000)}:R>`,
              },
            ),
          )
          .setColor('Green')
          .setTimestamp();

        await interaction.reply({
          embeds: [embed],
          ephemeral: true,
        });
        break;
      }

      case 'revoke': {
        const code = interaction.options.getString('code', true);
        const inviteInDb = await db.hubInvite.findFirst({
          where: {
            code,
            hub: {
              OR: [
                { ownerId: interaction.user.id },
                { moderators: { some: { userId: interaction.user.id, position: 'manager' } } },
              ],
            },
          },
        });

        if (!inviteInDb) {
          await interaction.reply({
            content: t({ phrase: 'hub.invite.revoke.invalidCode', locale }, { emoji: emojis.no }),
            ephemeral: true,
          });
          return;
        }

        try {
          await db.hubInvite.delete({ where: { code } });
          await this.replyEmbed(
            interaction,
            t(
              { phrase: 'hub.invite.revoke.success', locale },
              { emoji: emojis.yes, inviteCode: code },
            ),
            { ephemeral: true },
          );
        }
        catch (e) {
          Logger.error(e);
          captureException(e);
          await this.replyEmbed(
            interaction,
            t(
              { phrase: 'errors.unknown', locale },
              { emoji: emojis.no, support_invite: Constants.Links.SupportInvite },
            ),
            {
              ephemeral: true,
            },
          ).catch(() => null);
          return;
        }
        break;
      }

      case 'list': {
        const hubName = interaction.options.getString('hub', true);
        const hubInDb = await db.hub.findFirst({
          where: {
            name: hubName,
            OR: [
              { ownerId: interaction.user.id },
              { moderators: { some: { userId: interaction.user.id, position: 'manager' } } },
            ],
          },
        });

        if (!hubInDb?.private) {
          await this.replyEmbed(
            interaction,
            t({ phrase: 'hub.invite.list.notPrivate', locale }, { emoji: emojis.no }),
            { ephemeral: true },
          );
          return;
        }

        const invitesInDb = await db.hubInvite.findMany({ where: { hubId: hubInDb.id } });
        if (invitesInDb.length === 0) {
          await this.replyEmbed(
            interaction,
            t({ phrase: 'hub.invite.list.noInvites', locale }, { emoji: emojis.no }),
            { ephemeral: true },
          );
          return;
        }

        const inviteArr = invitesInDb.map(
          (inv, index) =>
            `${index + 1}. \`${inv.code}\` - <t:${Math.round(inv.expires.getTime() / 1000)}:R>`,
        );

        const inviteEmbed = new EmbedBuilder()
          .setTitle(t({ phrase: 'hub.invite.list.title', locale }))
          .setDescription(inviteArr.join('\n'))
          .setColor('Yellow')
          .setTimestamp();

        await interaction.reply({
          embeds: [inviteEmbed],
          ephemeral: true,
        });
        break;
      }

      default:
        break;
    }
  }
}
