import { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import Hub from './index.js';
import db from '../../../../utils/Db.js';
import { simpleEmbed } from '../../../../utils/Utils.js';
import { t } from '../../../../utils/Locale.js';
import { emojis } from '../../../../utils/Constants.js';

export default class Moderator extends Hub {
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const hubName = interaction.options.getString('hub', true);
    const hub = await db.hubs.findFirst({
      where: {
        name: hubName,
        OR: [
          { ownerId: interaction.user.id },
          { moderators: { some: { userId: interaction.user.id, position: 'manager' } } },
        ],
      },
    });

    if (!hub) {
      await interaction.reply({
        embeds: [
          simpleEmbed(
            t(
              { phrase: 'hub.notFound_mod', locale: interaction.user.locale },
              { emoji: emojis.no },
            ),
          ),
        ],
        ephemeral: true,
      });
      return;
    }

    switch (interaction.options.getSubcommand()) {
      case 'add': {
        const user = interaction.options.getUser('user', true);

        if (hub.moderators.find((mod) => mod.userId === user.id)) {
          await interaction.reply({
            embeds: [
              simpleEmbed(
                t(
                  { phrase: 'hub.moderator.add.alreadyModerator', locale: interaction.user.locale },
                  { user: user.toString(), emoji: emojis.no },
                ),
              ),
            ],
            ephemeral: true,
          });
          break;
        }

        const position = interaction.options.getString('position') ?? 'network_mod';
        await db.hubs.update({
          where: { id: hub.id },
          data: { moderators: { push: { userId: user.id, position } } },
        });

        await interaction.reply({
          content: t(
            { phrase: 'hub.moderator.add.success', locale: interaction.user.locale },
            { user: user.toString(), position, emoji: emojis.yes },
          ),
        });
        break;
      }

      case 'remove': {
        const user = interaction.options.getUser('user', true);

        if (!hub.moderators.find((mod) => mod.userId === user.id)) {
          await interaction.reply({
            content: t(
              { phrase: 'hub.moderator.remove.notModerator', locale: interaction.user.locale },
              { user: user.toString(), emoji: emojis.no },
            ),
            ephemeral: true,
          });
          break;
        }

        const isExecutorOwner = hub.ownerId === interaction.user.id;
        const mod = hub.moderators.find((m) => m.userId === user.id);
        const userIsManager = mod?.position === 'manager';

        if (
          (userIsManager && !isExecutorOwner) ||
          (user.id === interaction.user.id && !isExecutorOwner)
        ) {
          await interaction.reply({
            content: t(
              {
                phrase: 'hub.moderator.remove.notOwner',
                locale: interaction.user.locale,
              },
              { emoji: emojis.no },
            ),
            ephemeral: true,
          });
          break;
        }

        await db.hubs.update({
          where: { id: hub.id },
          data: {
            moderators: { deleteMany: { where: { userId: user.id } } },
          },
        });

        await interaction.reply(
          t(
            { phrase: 'hub.moderator.remove.success', locale: interaction.user.locale },
            { user: user.toString(), emoji: emojis.yes },
          ),
        );
        break;
      }

      case 'update': {
        const user = interaction.options.getUser('user', true);
        const position = interaction.options.getString('position', true);
        const isUserMod = hub.moderators.find((mod) => mod.userId === user.id);
        const isExecutorMod = hub.moderators.find(
          (mod) =>
            (mod.userId === interaction.user.id && mod.position === 'manager') ||
            hub.ownerId === interaction.user.id,
        );

        if (!isExecutorMod) {
          await interaction.reply({
            embeds: [
              simpleEmbed(
                t(
                  { phrase: 'hub.moderator.update.notAllowed', locale: interaction.user.locale },
                  { emoji: emojis.no },
                ),
              ),
            ],
            ephemeral: true,
          });
          break;
        }
        else if (!isUserMod) {
          await interaction.reply({
            embeds: [
              simpleEmbed(
                t(
                  {
                    phrase: 'hub.moderator.update.nodModerator',
                    locale: interaction.user.locale,
                  },
                  { user: user.toString() },
                ),
              ),
            ],
            ephemeral: true,
          });
          break;
        }
        else if (
          (hub.ownerId !== interaction.user.id && user.id === interaction.user.id) ||
          isUserMod.position === 'manager'
        ) {
          await interaction.reply({
            embeds: [
              simpleEmbed(
                t(
                  {
                    phrase: 'hub.moderator.update.notOwner',
                    locale: interaction.user.locale,
                  },
                  { emoji: emojis.no },
                ),
              ),
            ],
            ephemeral: true,
          });
          break;
        }

        await db.hubs.update({
          where: { id: hub.id },
          data: {
            moderators: {
              updateMany: { where: { userId: user.id }, data: { position } },
            },
          },
        });

        await interaction.reply(
          t(
            { phrase: 'hub.moderator.update.success', locale: interaction.user.locale },
            { user: user.toString(), position, emoji: emojis.yes },
          ),
        );
        break;
      }

      case 'list': {
        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setTitle('Hub Moderators')
              .setDescription(
                hub.moderators.length > 0
                  ? hub.moderators
                    .map(
                      (mod, index) =>
                        `${index + 1}. <@${mod.userId}> - ${
                          mod.position === 'network_mod' ? 'Network Moderator' : 'Hub Manager'
                        }`,
                    )
                    .join('\n')
                  : t(
                    { phrase: 'hub.moderator.noModerators', locale: interaction.user.locale },
                    { emoji: emojis.no },
                  ),
              )
              .setColor('Aqua')
              .setTimestamp(),
          ],
          ephemeral: true,
        });
        break;
      }
      default:
        break;
    }

    return;
  }
}
