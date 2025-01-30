import { getEmoji } from '#src/utils/EmojiUtils.js';
import getRedis from '#src/utils/Redis.js';
import { handleError } from '#src/utils/Utils.js';
import { RedisKeys } from '#utils/Constants.js';
import { CustomID } from '#utils/CustomID.js';
import db from '#utils/Db.js';
import { InfoEmbed } from '#utils/EmbedUtils.js';
import { type supportedLocaleCodes, t } from '#utils/Locale.js';
import type { HubLogConfig, Prisma } from '@prisma/client';
import { stripIndents } from 'common-tags';
import {
  ActionRowBuilder,
  type Client,
  type Snowflake,
  StringSelectMenuBuilder,
  roleMention,
} from 'discord.js';

export type RoleIdLogConfigs = 'appeals' | 'reports' | 'networkAlerts';
export type LogConfigTypes = keyof Omit<Omit<HubLogConfig, 'hubId'>, 'id'>;
export const logsWithRoleId = ['appeals', 'reports', 'networkAlerts'];

export default class HubLogManager {
  public readonly hubId: string;
  private logConfig: HubLogConfig;
  readonly logsWithRoleId = logsWithRoleId;
  readonly logTypes: LogConfigTypes[];

  constructor(logConfig: HubLogConfig) {
    this.hubId = logConfig.hubId;
    this.logConfig = logConfig;
    this.logTypes = Object.keys(logConfig).filter(
      (key) => key !== 'hubId' && key !== 'id',
    ) as LogConfigTypes[];
  }

  static async create(hubId: string) {
    const logConfigCache = await getRedis().get(
      `${RedisKeys.hubLogConfig}:${hubId}`,
    );
    const logConfig = logConfigCache
      ? JSON.parse(logConfigCache)
      : await db.hubLogConfig.upsert({
        where: { hubId },
        create: { hubId },
        update: { hubId },
      });

    return new HubLogManager(logConfig as HubLogConfig);
  }

  get config() {
    return this.logConfig;
  }

  async deleteAll() {
    await db.hubLogConfig.delete({ where: { hubId: this.hubId } });
    this.logConfig = {} as HubLogConfig;
    this.refreshCache();
  }

  protected async updateLogConfig(data: Prisma.HubLogConfigUpdateInput) {
    const updated = await db.hubLogConfig.update({
      where: { hubId: this.hubId },
      data,
    });
    this.logConfig = updated;
    this.refreshCache();
  }

  private async refreshCache() {
    try {
      await getRedis().set(
        `${RedisKeys.hubLogConfig}:${this.hubId}`,
        JSON.stringify(this.logConfig),
      );
    }
    catch (error) {
      handleError(error, {
        comment: 'Failed to refresh cache for hub log config',
      });
    }
  }

  async setLogChannel(type: LogConfigTypes, channelId: string) {
    await this.updateLogConfig({
      [type]: { upsert: { set: { channelId }, update: { channelId } } },
    });
  }

  async resetLog(...type: LogConfigTypes[]) {
    await this.updateLogConfig(
      type.reduce(
        (acc, typ) => Object.assign(acc, { [typ]: { unset: true } }),
        {},
      ),
    );
  }

  async setRoleId(type: RoleIdLogConfigs, roleId: string) {
    if (!this.config[type]?.channelId) throw new Error('Channel ID must be set before .');

    await this.updateLogConfig({
      [type]: {
        upsert: {
          set: { roleId, channelId: this.config[type].channelId },
          update: { roleId },
        },
      },
    });
  }

  async removeRoleId(type: RoleIdLogConfigs) {
    if (!this.config[type]) return await this.resetLog(type);

    await this.updateLogConfig({
      appeals: { set: { channelId: this.config[type].channelId } },
    });
  }

  async setChannelAndRole(
    type: LogConfigTypes,
    channelId: string,
    roleId: string,
  ) {
    if (!this.logsWithRoleId.includes(type)) return;

    await this.setLogChannel(type, channelId);
    await this.setRoleId(type as RoleIdLogConfigs, roleId);
  }

  public getEmbed(client: Client, locale: supportedLocaleCodes = 'en') {
    const channelStr = t('hub.manage.logs.config.fields.channel', locale);
    const roleStr = t('hub.manage.logs.config.fields.role', locale);

    const divider = getEmoji('divider', client);
    const dividerEnd = getEmoji('dividerEnd', client);
    const x_icon = getEmoji('x_icon', client);

    const logDesc = this.logTypes
      .map((type) => {
        const configType = this.config[type];
        const mentionedRole =
					typeof configType !== 'string' && configType?.roleId
					  ? roleMention(configType.roleId)
					  : x_icon;
        const roleInfo = this.logsWithRoleId.includes(type)
          ? `${dividerEnd} ${roleStr} ${mentionedRole}`
          : '';

        const channelId =
					typeof configType === 'string' ? configType : configType?.channelId;
        return stripIndents`
          ${getEmoji('arrow', client)} \`${type}:\`
          ${divider} ${t(`hub.manage.logs.${type}.description`, locale)}
          ${roleInfo ? divider : dividerEnd} ${channelStr} ${channelId ? `<#${channelId}>` : x_icon}
          ${roleInfo}`;
      })
      .join('\n');

    return new InfoEmbed()
      .removeTitle()
      .setDescription(`## ${t('hub.manage.logs.title', locale)}\n\n${logDesc}`)
      .setThumbnail('https://i.imgur.com/tHVt3Gw.png');
  }

  public createSelectMenu(
    userId: Snowflake,
    hubId: string,
    locale: supportedLocaleCodes,
  ) {
    return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(
          new CustomID()
            .setIdentifier('hubEdit', 'logsSelect')
            .setArgs(userId)
            .setArgs(hubId)
            .toString(),
        )
        .setPlaceholder('Choose a log type to set a channel.')
        .addOptions([
          {
            label: t('hub.manage.logs.reports.label', locale),
            value: 'reports',
            description: t('hub.manage.logs.reports.description', locale),
            emoji: '📢',
          },
          {
            label: t('hub.manage.logs.modLogs.label', locale),
            value: 'modLogs',
            description: t('hub.manage.logs.modLogs.description', locale),
            emoji: '👮',
          },
          {
            label: t('hub.manage.logs.profanity.label', locale),
            value: 'profanity',
            description: t('hub.manage.logs.profanity.description', locale),
            emoji: '🤬',
          },
          {
            label: t('hub.manage.logs.joinLeaves.label', locale),
            value: 'joinLeaves',
            description: t('hub.manage.logs.joinLeaves.description', locale),
            emoji: '👋',
          },
          {
            label: 'Appeals',
            value: 'appeals',
            description:
							'Appeals from users/servers who have been blacklisted.',
            emoji: '📝',
          },
        ]),
    );
  }
}
