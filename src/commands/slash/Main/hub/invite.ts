import { ChatInputCommandInteraction, CacheType, EmbedBuilder } from 'discord.js';
import Hub from './index.js';
import { captureException } from '@sentry/node';
import { emojis } from '../../../../utils/Constants.js';
import db from '../../../../utils/Db.js';
import Logger from '../../../../utils/Logger.js';
import { simpleEmbed } from '../../../../utils/Utils.js';
import { __ } from '../../../../utils/Locale.js';

export default class Invite extends Hub {
  readonly cooldown = 3000; // 3 seconds

  async execute(interaction: ChatInputCommandInteraction<CacheType>) {
    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case 'create': {
        const expires = new Date();
        const hubName = interaction.options.getString('hub', true);
        const hours = interaction.options.getNumber('expiry');
        hours
          ? expires.setHours(expires.getHours() + hours)
          : expires.setHours(expires.getHours() + 24);

        const hubInDb = await db.hubs.findFirst({
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
          await interaction.reply({
            embeds: [
              simpleEmbed(__({ phrase: 'hub.notFound_mod', locale: interaction.user.locale })),
            ],
            ephemeral: true,
          });
          return;
        }
        const createdInvite = await db.hubInvites.create({
          data: {
            expires,
            hub: { connect: { name: hubName } },
          },
        });

        const embed = new EmbedBuilder()
          .setDescription(
            __(
              { phrase: 'hub.invite.create.success', locale: interaction.user.locale },
              {
                inviteCode: createdInvite.code,
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
        const inviteInDb = await db.hubInvites.findFirst({
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
            content: __({
              phrase: 'hub.invite.revoke.invalidCode',
              locale: interaction.user.locale,
            }),
            ephemeral: true,
          });
          return;
        }

        try {
          await db.hubInvites.delete({ where: { code } });
          await interaction.reply({
            embeds: [
              simpleEmbed(
                __(
                  { phrase: 'hub.invite.revoke.success', locale: interaction.user.locale },
                  { emoji: emojis.yes, inviteCode: code },
                ),
              ),
            ],
            ephemeral: true,
          });
        }
        catch (e) {
          Logger.error(e);
          captureException(e);
          await interaction
            .reply({
              embeds: [
                simpleEmbed(__({ phrase: 'errors.unknown', locale: interaction.user.locale })),
              ],
              ephemeral: true,
            })
            .catch(() => null);
          return;
        }
        break;
      }

      case 'list': {
        const hubName = interaction.options.getString('hub', true);
        const hubInDb = await db.hubs.findFirst({
          where: {
            name: hubName,
            OR: [
              { ownerId: interaction.user.id },
              { moderators: { some: { userId: interaction.user.id, position: 'manager' } } },
            ],
          },
        });

        if (!hubInDb?.private) {
          await interaction.reply({
            embeds: [
              simpleEmbed(
                __({ phrase: 'hub.invite.list.notPrivate', locale: interaction.user.locale }),
              ),
            ],
            ephemeral: true,
          });
          return;
        }

        const invitesInDb = await db.hubInvites.findMany({ where: { hubId: hubInDb.id } });
        if (invitesInDb.length === 0) {
          await interaction.reply({
            embeds: [
              simpleEmbed(
                __({ phrase: 'hub.invite.list.noInvites', locale: interaction.user.locale }),
              ),
            ],
            ephemeral: true,
          });
          return;
        }

        const inviteArr = invitesInDb.map(
          (inv, index) =>
            `${index + 1}. \`${inv.code}\` - <t:${Math.round(inv.expires.getTime() / 1000)}:R>`,
        );

        const inviteEmbed = new EmbedBuilder()
          .setTitle(__({ phrase: 'hub.invite.list.title', locale: interaction.user.locale }))
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
