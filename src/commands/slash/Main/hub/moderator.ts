import { emojis } from '#main/utils/Constants.js';
import db from '#main/utils/Db.js';
import { t } from '#main/utils/Locale.js';
import { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import Hub from './index.js';

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

    const { userManager } = interaction.client;
    const locale = await userManager.getUserLocale(interaction.user.id);
    if (!hub) {
      await this.replyEmbed(
        interaction,
        t({ phrase: 'hub.notFound_mod', locale }, { emoji: emojis.no }),
        { ephemeral: true },
      );
      return;
    }

    switch (interaction.options.getSubcommand()) {
      case 'add': {
        const user = interaction.options.getUser('user', true);

        if (hub.moderators.find((mod) => mod.userId === user.id)) {
          await this.replyEmbed(
            interaction,
            t(
              { phrase: 'hub.moderator.add.alreadyModerator', locale },
              { user: user.toString(), emoji: emojis.no },
            ),
            { ephemeral: true },
          );
          break;
        }

        const position = interaction.options.getString('position') ?? 'network_mod';
        await db.hubs.update({
          where: { id: hub.id },
          data: { moderators: { push: { userId: user.id, position } } },
        });

        await interaction.reply({
          content: t(
            { phrase: 'hub.moderator.add.success', locale },
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
              { phrase: 'hub.moderator.remove.notModerator', locale },
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
            content: t({ phrase: 'hub.moderator.remove.notOwner', locale }, { emoji: emojis.no }),
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
            { phrase: 'hub.moderator.remove.success', locale },
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
          await this.replyEmbed(
            interaction,
            t({ phrase: 'hub.moderator.update.notAllowed', locale }, { emoji: emojis.no }),
            { ephemeral: true },
          );
          break;
        }
        else if (!isUserMod) {
          await this.replyEmbed(
            interaction,
            t(
              { phrase: 'hub.moderator.update.notModerator', locale },
              { user: user.toString(), emoji: emojis.no },
            ),
            { ephemeral: true },
          );
          break;
        }
        else if (
          (hub.ownerId !== interaction.user.id && user.id === interaction.user.id) ||
          isUserMod.position === 'manager'
        ) {
          await this.replyEmbed(
            interaction,
            t({ phrase: 'hub.moderator.update.notOwner', locale }, { emoji: emojis.no }),
            { ephemeral: true },
          );
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
            { phrase: 'hub.moderator.update.success', locale },
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
                  : t({ phrase: 'hub.moderator.noModerators', locale }, { emoji: emojis.no }),
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
  }
}
