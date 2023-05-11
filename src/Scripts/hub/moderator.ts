import { ChatInputCommandInteraction } from 'discord.js';
import { getDb } from '../../Utils/functions/utils';

export async function execute(interaction: ChatInputCommandInteraction) {
  const db = getDb();
  const hubName = interaction.options.getString('hub', true);
  const user = interaction.options.getUser('user', true);
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

    case 'remove':
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

    case 'update': {
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
    default:
      break;
  }
}
