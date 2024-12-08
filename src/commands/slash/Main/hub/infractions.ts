import HubCommand from '#main/commands/slash/Main/hub/index.js';
import { InfractionManagerFactory } from '#main/managers/InfractionManager/InfractionManagerFactory.js';
import { Pagination } from '#main/modules/Pagination.js';
import { RemoveMethods } from '#main/types/Utils.js';
import { msToReadable } from '#main/utils/Utils.js';
import Constants, { emojis } from '#utils/Constants.js';
import db from '#utils/Db.js';
import { t } from '#utils/Locale.js';
import {
  buildInfractionListEmbeds,
  isServerInfraction,
} from '#utils/moderation/infractionUtils.js';
import { Hub, ServerInfraction, UserInfraction } from '@prisma/client';
import { stripIndents } from 'common-tags';
import {
  BaseMessageOptions,
  Client,
  Collection,
  EmbedBuilder,
  Guild,
  time,
  User,
  type ChatInputCommandInteraction,
} from 'discord.js';

// Types for better type safety and documentation
type InfractionType = 'server' | 'user';
type GroupedInfraction = (UserInfraction | ServerInfraction) & { count: number };

interface TargetInfo {
  name: string;
  iconURL: string;
}

export default class ViewInfractions extends HubCommand {
  private static readonly INFRACTIONS_PER_PAGE = 5;

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    const hub = await this.validateAndGetHub(interaction);
    if (!hub) return;

    const type = interaction.options.getString('type', true) as InfractionType;
    const targetId = interaction.options.getString('target');

    if (!targetId) {
      await this.showAllInfractions(interaction, hub, type);
      return;
    }

    await this.showTargetInfractions(interaction, hub, type, targetId);
  }

  private async validateAndGetHub(interaction: ChatInputCommandInteraction): Promise<Hub | null> {
    const hubName = interaction.options.getString('hub', true);
    const hub = await db.hub.findFirst({
      where: {
        name: hubName,
        OR: [
          { ownerId: interaction.user.id },
          { moderators: { some: { userId: interaction.user.id } } },
        ],
      },
    });

    if (!hub) {
      const locale = await interaction.client.userManager.getUserLocale(interaction.user.id);
      await this.replyEmbed(interaction, t('hub.notFound_mod', locale, { emoji: emojis.no }));
      return null;
    }

    return hub;
  }

  private async showTargetInfractions(
    interaction: ChatInputCommandInteraction,
    hub: Hub,
    type: InfractionType,
    targetId: string,
  ) {
    const targetInfo = await this.getTargetInfo(interaction.client, type, targetId, hub.iconUrl);
    const infractionManager = InfractionManagerFactory.create(type, targetId);
    const infractions = await infractionManager.getHubInfractions(hub.id);

    // Update target name if it's a server infraction
    const finalTargetName = isServerInfraction(infractions[0])
      ? infractions[0].serverName
      : targetInfo.name;

    const embeds = await buildInfractionListEmbeds(
      interaction.client,
      finalTargetName,
      infractions,
      type,
      targetInfo.iconURL,
    );

    await this.displayPagination(interaction, embeds);
  }

  private async getTargetInfo(
    client: Client,
    type: InfractionType,
    targetId: string,
    defaultIconURL: string,
  ): Promise<TargetInfo> {
    if (type === 'user') {
      const user = await client.users.fetch(targetId).catch(() => null);
      return {
        name: user?.username ?? 'Unknown User',
        iconURL: user?.displayAvatarURL() ?? defaultIconURL,
      };
    }
    return {
      name: 'Unknown',
      iconURL: defaultIconURL,
    };
  }

  private async showAllInfractions(
    interaction: ChatInputCommandInteraction,
    hub: Hub,
    type: InfractionType,
  ) {
    const groupedInfractions = await this.getGroupedInfractions(hub.id, type);
    const embeds = await this.buildAllInfractionsEmbed(
      interaction.client,
      groupedInfractions,
      type,
    );
    await this.displayPagination(interaction, embeds);
  }

  private async getGroupedInfractions(
    hubId: string,
    type: InfractionType,
  ): Promise<Collection<string, GroupedInfraction>> {
    // Fetch all infractions in a single query with included relations
    const infractions = await (type === 'server'
      ? db.serverInfraction.findMany({
        where: { hubId },
        orderBy: { dateIssued: 'desc' },
      })
      : db.userInfraction.findMany({
        where: { hubId },
        orderBy: { dateIssued: 'desc' },
      }));

    // Group infractions by target ID
    return infractions.reduce((grouped, infraction) => {
      const targetId = this.getTargetId(infraction);
      const existing = grouped.get(targetId);

      if (!existing) {
        grouped.set(targetId, { ...infraction, count: 1 });
      }
      else {
        // Only update count since we're already sorted by date
        grouped.set(targetId, { ...existing, count: existing.count + 1 });
      }

      return grouped;
    }, new Collection<string, GroupedInfraction>());
  }

  private async buildAllInfractionsEmbed(
    client: Client,
    groupedInfractions: Collection<string, GroupedInfraction>,
    type: InfractionType,
  ) {
    const pages: BaseMessageOptions[] = [];
    const targetIds = [...groupedInfractions.keys()];

    // Batch fetch all users/servers at once
    const [targets, moderators] = await Promise.all([
      this.batchFetchTargets(client, targetIds, type),
      this.batchFetchModerators(client, [
        ...new Set(groupedInfractions.map((i) => i.moderatorId).filter(Boolean) as string[]),
      ]),
    ]);

    let currentFields: { name: string; value: string }[] = [];
    let counter = 0;

    for (const [targetId, infraction] of groupedInfractions) {
      const target = targets.get(targetId);
      const moderator = moderators.get(infraction.moderatorId ?? '') ?? null;

      const field = {
        name: `${this.getTargetName(target, infraction)} (${targetId}) (${time(infraction.dateIssued, 'R')})`,
        value: this.formatInfractionDetails(
          infraction,
          moderator,
          this.formatExpirationTime(infraction.expiresAt),
        ),
      };

      currentFields.push(field);
      counter++;

      if (this.shouldCreateNewPage(counter, currentFields.length, groupedInfractions.size)) {
        pages.push(this.createPageEmbed(currentFields));
        currentFields = [];
        counter = 0;
      }
    }

    return pages;
  }

  private async batchFetchTargets(client: Client, targetIds: string[], type: InfractionType) {
    const targets = new Collection<string, User | RemoveMethods<Guild>>();

    if (type === 'user') {
      const users = await Promise.all(
        targetIds.map((id) => client.users.fetch(id).catch(() => null)),
      );
      users.forEach((user, index) => {
        if (user) targets.set(targetIds[index], user);
      });
    }
    else {
      const guilds = await Promise.all(
        targetIds.map((id) => client.fetchGuild(id).catch(() => null)),
      );
      guilds.forEach((guild, index) => {
        if (guild) targets.set(targetIds[index], guild);
      });
    }

    return targets;
  }

  private async batchFetchModerators(client: Client, moderatorIds: string[]) {
    const moderators = new Collection<string, User>();

    const users = await Promise.all(
      moderatorIds.map((id) => client.users.fetch(id).catch(() => null)),
    );

    users.forEach((user, index) => {
      if (user) moderators.set(moderatorIds[index], user);
    });

    return moderators;
  }

  private getTargetName(
    target: User | RemoveMethods<Guild> | undefined,
    infraction: GroupedInfraction,
  ): string {
    if (!target) {
      return 'userId' in infraction ? 'Unknown User' : (infraction.serverName ?? 'Unknown Server');
    }
    return target instanceof User ? target.username : target.name;
  }

  private getTargetId(infraction: UserInfraction | ServerInfraction): string {
    return 'userId' in infraction ? infraction.userId : infraction.serverId;
  }

  private async createInfractionField(client: Client, infraction: GroupedInfraction) {
    const moderator = await this.fetchModerator(client, infraction.moderatorId);
    const expiresAt = this.formatExpirationTime(infraction.expiresAt);
    const targetInfo = await this.getTargetFieldInfo(client, infraction);

    return {
      name: `${targetInfo.name} (${targetInfo.id}) (${time(infraction.dateIssued, 'R')})`,
      value: this.formatInfractionDetails(infraction, moderator, expiresAt),
    };
  }

  private async fetchModerator(client: Client, moderatorId: string | null) {
    if (!moderatorId) return null;
    return await client.users.fetch(moderatorId).catch(() => null);
  }

  private formatExpirationTime(expiresAt: Date | null): string {
    if (!expiresAt) return 'Never';

    return expiresAt > new Date()
      ? msToReadable(expiresAt.getTime() - Date.now())
      : `Expired at ${expiresAt.toLocaleDateString()}`;
  }

  private async getTargetFieldInfo(client: Client, infraction: GroupedInfraction) {
    const targetId = this.getTargetId(infraction);

    if ('userId' in infraction) {
      const user = await client.users.fetch(targetId).catch(() => null);
      return { name: user?.username ?? 'Unknown User', id: targetId };
    }

    const guild = await client.fetchGuild(targetId).catch(() => null);
    return {
      name: guild?.name ?? infraction.serverName ?? 'Unknown Server',
      id: targetId,
    };
  }

  private formatInfractionDetails(
    infraction: GroupedInfraction,
    moderator: User | null,
    expiresAt: string,
  ): string {
    return stripIndents`
      - **Total Infractions**: ${infraction.count}
      - **Latest Infraction**:
        > \`\`\`yaml
        > Type: ${infraction.type}
        > Status: ${infraction.status}
        > Reason: ${infraction.reason}
        > Moderator: ${moderator?.username ?? 'Unknown.'}
        > Expires: ${expiresAt}
        > \`\`\`
    `;
  }

  private shouldCreateNewPage(counter: number, fieldsLength: number, totalSize: number): boolean {
    return counter >= ViewInfractions.INFRACTIONS_PER_PAGE || fieldsLength === totalSize;
  }

  private createPageEmbed(fields: { name: string; value: string }[]) {
    return {
      embeds: [
        new EmbedBuilder()
          .setTitle('All Infractions for this hub')
          .setFields(fields)
          .setColor(Constants.Colors.invisible)
          .setFooter({
            text: 'To view a specific user or server\'s infractions, use the command with the target\'s ID.',
          }),
      ],
    };
  }

  private async displayPagination(
    interaction: ChatInputCommandInteraction,
    pages: BaseMessageOptions[],
  ) {
    const paginator = new Pagination().addPages(pages);
    await paginator.run(interaction);
  }
}
