import { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { getDb } from '../../Utils/misc/utils';

export async function execute(interaction: ChatInputCommandInteraction) {
  const db = getDb();
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
    return await interaction.reply({
      content: 'Invalid hub input. Make sure the hub exists and that you are a owner/manager of the hub.',
      ephemeral: true,
    });
  }

  switch (interaction.options.getSubcommand()) {
    case 'add': {
      const user = interaction.options.getUser('user', true);

      if (hub.moderators.find((mod) => mod.userId === user.id)) {
        return interaction.reply({
          content: `User ${user} is already a moderator for **${hub.name}**!`,
          ephemeral: true,
        });
      }

      const position = interaction.options.getString('role') ?? 'network_mod';
      await db.hubs.update({
        where: { id: hub.id },
        data: { moderators: { push: { userId: user.id, position } } },
      });
      interaction.reply(`Added ${user} as a hub moderator for **${hub.name}**!`);
      break;
    }

    case 'remove': {
      const user = interaction.options.getUser('user', true);

      if (!hub.moderators.find((mod) => mod.userId === user.id)) {
        return interaction.reply({
          content: `User ${user} is not a moderator for **${hub.name}**!`,
          ephemeral: true,
        });
      }

      await db.hubs.update({
        where: { id: hub.id },
        data: {
          moderators: { deleteMany: { where: { userId: user.id } } },
        },
      });
      interaction.reply(`Removed hub moderator ${user} from **${hub.name}**!`);
      break;
    }

    case 'update': {
      const user = interaction.options.getUser('user', true);

      const position = interaction.options.getString('role', true);
      if (!hub.moderators.find((mod) => mod.userId === user.id)) {
        return interaction.reply({
          content: `User ${user} is not a moderator for **${hub.name}**!`,
          ephemeral: true,
        });
      }

      await db.hubs.update({
        where: { id: hub.id },
        data: {
          moderators: {
            updateMany: { where: { userId: user.id }, data: { position } },
          },
        },
      });
      interaction.reply(`Sucessfully moved ${user} to the role of \`${position}\` for **${hub.name}**!`);
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
                  .map((mod, index) => `${index + 1}. <@${mod.userId}> - ${mod.position === 'network_mod' ? 'Network Moderator' : 'Hub Manager'}`)
                  .join('\n')
                : 'There are no moderators for this hub yet.',
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
