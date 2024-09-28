import { emojis } from '#main/config/Constants.js';
import db from '#main/utils/Db.js';
import { type supportedLocaleCodes, t } from '#main/utils/Locale.js';
import type { HubModeratorPosition, Hub } from '@prisma/client';
import { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import HubCommand from './index.js';

export default class Moderator extends HubCommand {
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const hubName = interaction.options.getString('hub', true);
    const hub = await db.hub.findFirst({
      where: {
        name: hubName,
        OR: [
          { ownerId: interaction.user.id },
          { moderators: { some: { userId: interaction.user.id, position: 'manager' } } },
        ],
      },
    });

    const locale = await interaction.client.userManager.getUserLocale(interaction.user.id);
    if (!hub) {
      await this.replyEmbed(
        interaction,
        t({ phrase: 'hub.notFound_mod', locale }, { emoji: emojis.no }),
        { ephemeral: true },
      );
      return;
    }

    switch (interaction.options.getSubcommand()) {
      case 'add':
        await this.handleAddSubcommand(interaction, hub, locale);
        break;
      case 'remove':
        await this.handleRemoveSubcommand(interaction, hub, locale);
        break;
      case 'update':
        await this.handleUpdateSubcommand(interaction, hub, locale);
        break;
      case 'list':
        await this.handleListSubcommand(interaction, hub, locale);
        break;

      default:
        break;
    }
  }
  private async handleRemoveSubcommand(
    interaction: ChatInputCommandInteraction,
    hub: Hub,
    locale: supportedLocaleCodes,
  ) {
    const user = interaction.options.getUser('user', true);
    if (!hub.moderators.find((mod) => mod.userId === user.id)) {
      await this.replyEmbed(
        interaction,
        t(
          { phrase: 'hub.moderator.remove.notModerator', locale },
          { user: user.toString(), emoji: emojis.no },
        ),
        { ephemeral: true },
      );
      return;
    }

    const mod = hub.moderators.find((m) => m.userId === user.id);

    const isRestrictedAction = mod?.position === 'manager' || user.id === interaction.user.id;
    const isExecutorOwner = hub.ownerId === interaction.user.id;

    /* executor needs to be owner to:
     - change position of other managers
     - change their own position
     */
    if (!isExecutorOwner && isRestrictedAction) {
      await this.replyEmbed(
        interaction,
        t({ phrase: 'hub.moderator.remove.notOwner', locale }, { emoji: emojis.no }),
        { ephemeral: true },
      );
      return;
    }

    await db.hub.update({
      where: { id: hub.id },
      data: {
        moderators: { deleteMany: { where: { userId: user.id } } },
      },
    });

    await this.replyEmbed(
      interaction,
      t(
        { phrase: 'hub.moderator.remove.success', locale },
        { user: user.toString(), emoji: emojis.yes },
      ),
    );
  }

  private async handleUpdateSubcommand(
    interaction: ChatInputCommandInteraction,
    hub: Hub,
    locale: supportedLocaleCodes,
  ) {
    const user = interaction.options.getUser('user', true);
    const position = interaction.options.getString('position', true) as HubModeratorPosition;
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
      return;
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
      return;
    }
    else if (user.id === interaction.user.id || isUserMod.position === 'manager') {
      await this.replyEmbed(
        interaction,
        t({ phrase: 'hub.moderator.update.notOwner', locale }, { emoji: emojis.no }),
        { ephemeral: true },
      );
      return;
    }

    await db.hub.update({
      where: { id: hub.id },
      data: {
        moderators: { updateMany: { where: { userId: user.id }, data: { position } } },
      },
    });

    await this.replyEmbed(
      interaction,
      t(
        { phrase: 'hub.moderator.update.success', locale },
        { user: user.toString(), position, emoji: emojis.yes },
      ),
    );
  }

  private async handleListSubcommand(
    interaction: ChatInputCommandInteraction,
    hub: Hub,
    locale: supportedLocaleCodes,
  ) {
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
  }

  private async handleAddSubcommand(
    interaction: ChatInputCommandInteraction,
    hub: Hub,
    locale: supportedLocaleCodes,
  ) {
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
      return;
    }

    const position = (interaction.options.getString('position') ??
      'network_mod') as HubModeratorPosition;
    await db.hub.update({
      where: { id: hub.id },
      data: { moderators: { push: { userId: user.id, position } } },
    });

    await this.replyEmbed(
      interaction,
      t(
        { phrase: 'hub.moderator.add.success', locale },
        { user: user.toString(), position, emoji: emojis.yes },
      ),
    );
  }
}
