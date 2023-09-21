import { captureException } from '@sentry/node';
import { logger } from '@sentry/utils';
import { stripIndents } from 'common-tags';
import { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { getDb } from '../../Utils/misc/utils';
import emojis from '../../Utils/JSON/emoji.json';

export async function execute(interaction: ChatInputCommandInteraction) {
  const db = getDb();
  const subcommand = interaction.options.getSubcommand();

  switch (subcommand) {
    case 'create': {
      const expires = new Date();
      const hubName = interaction.options.getString('hub', true);
      const hours = interaction.options.getNumber('expiry');
      hours
        ? expires.setHours(expires.getHours() + hours)
        : expires.setHours(expires.getHours() + 24);

      const hubInDb = await db.hubs.findFirst({ where: { name: hubName } });

      if (!hubInDb || hubInDb.ownerId != interaction.user.id || !hubInDb.private) {
        await interaction.reply({
          content: `${emojis.normal.no} Invalid Hub Provided. Make sure provided hub is one that you own and that it is private.`,
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
        .setTitle('Invite Created')
        .setDescription(stripIndents`
          Give this code to someone who wishes to join the hub. This invite has unlimited uses.
          
          **Code:** \`${createdInvite.code}\`
          **Expiry <t:${Math.round(createdInvite.expires.getTime() / 1000)}:R>**
        `)
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
              { moderators: { some: { userId: interaction.user.id } } },
            ],
          },
        },
      });


      if (!inviteInDb) {
        await interaction.reply({
          content: `${emojis.normal.no} Invalid Invite Code.`,
          ephemeral: true,
        });
        return;
      }

      try {
        await db.hubInvites.delete({ where: { code } });
        await interaction.reply({
          content: `Successfully revoked invite \`${code}\`!`,
          ephemeral: true,
        });
      }
      catch (e) {
        logger.error(e);
        captureException(e);
        await interaction.reply({
          content: 'An error occoured while trying to revoke invite! The developers have been notified.',
          ephemeral: true,
        }).catch(() => null);
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
            { moderators: { some: { userId: interaction.user.id } } },
          ],
        },
      });

      if (!hubInDb?.private) {
        await interaction.reply({
          content: 'You can only view invite codes for private hubs.',
          ephemeral: true,
        });
        return;
      }

      const invitesInDb = await db.hubInvites.findMany({ where: { hubId: hubInDb.id } });
      if (invitesInDb.length === 0) {
        await interaction.reply({
          content: `${emojis.normal.yes} There are no invites to this hub yet.`,
          ephemeral: true,
        });
        return;
      }

      const inviteArr = invitesInDb.map((inv, index) =>
        `${index + 1}. \`${inv.code}\` - <t:${Math.round(inv.expires.getTime() / 1000)}:R>`,
      );

      const inviteEmbed = new EmbedBuilder()
        .setTitle('Invite Codes')
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
