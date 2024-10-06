import HubCommand from '#main/commands/slash/Main/hub/index.js';
import { emojis } from '#main/config/Constants.js';
import ServerInfractionManager from '#main/managers/InfractionManager/ServerInfractionManager.js';
import UserInfractionManager from '#main/managers/InfractionManager/UserInfractionManager.js';
import { Pagination } from '#main/modules/Pagination.js';
import db from '#main/utils/Db.js';
import { t } from '#main/utils/Locale.js';
import {
  buildInfractionListEmbeds,
  isServerInfraction,
} from '#main/utils/moderation/infractionUtils.js';
import { type ChatInputCommandInteraction } from 'discord.js';

export default class ViewInfractions extends HubCommand {
  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    const hubName = interaction.options.getString('hub', true);
    const hubInDb = await db.hub.findFirst({
      where: {
        name: hubName,
        OR: [
          { ownerId: interaction.user.id },
          { moderators: { some: { userId: interaction.user.id } } },
        ],
      },
    });

    const { userManager } = interaction.client;
    const locale = await userManager.getUserLocale(interaction.user.id);
    if (!hubInDb) {
      await this.replyEmbed(interaction, t('hub.notFound_mod', locale, { emoji: emojis.no }));
      return;
    }

    const type = interaction.options.getString('type', true) as 'server' | 'user';
    const targetId = interaction.options.getString('target', true);
    let targetName = 'Unknown.';
    let iconURL = hubInDb.iconUrl;

    let infractionManager;

    if (type === 'user') {
      infractionManager = new UserInfractionManager(targetId);

      const user = await interaction.client.users.fetch(targetId).catch(() => null);
      targetName = user?.username ?? 'Unknown User.';
      iconURL = user?.displayAvatarURL() ?? iconURL;
    }
    else {
      infractionManager = new ServerInfractionManager(targetId);
    }

    const infractions = await infractionManager.getHubInfractions(hubInDb.id);
    targetName = isServerInfraction(infractions[0]) ? infractions[0].serverName : targetName;

    const embeds = await buildInfractionListEmbeds(
      interaction.client,
      targetName,
      infractions,
      type,
      iconURL,
    );

    const paginator = new Pagination().addPages(embeds);
    paginator.run(interaction);
  }
}
