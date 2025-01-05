import type HubManager from '#main/managers/HubManager.js';
import {
  HubSettingsBitField,
  HubSettingsBits,
  type HubSettingsString,
} from '#main/modules/BitFields.js';
import { HubService } from '#main/services/HubService.js';
import Constants from '#main/utils/Constants.js';
import { InfoEmbed } from '#main/utils/EmbedUtils.js';
import { getEmoji } from '#main/utils/EmojiUtils.js';

import type { BitFieldResolvable, Client, EmbedBuilder } from 'discord.js';

export default class HubSettingsManager {
  private readonly hub: HubManager;
  private settings: HubSettingsBitField;

  constructor(hub: HubManager) {
    this.hub = hub;
    this.settings = new HubSettingsBitField(hub.data.settings ?? 0);
  }

  static async create(hubId: string): Promise<HubSettingsManager> {
    const hub = await new HubService().fetchHub(hubId);
    if (!hub) throw new Error('Hub not found');
    return new HubSettingsManager(hub);
  }

  async updateSetting(setting: HubSettingsString, value?: boolean): Promise<boolean> {
    if (value) this.settings.add(setting);
    else if (value === undefined) this.settings.toggle(setting);
    else this.settings.remove(setting);

    await this.saveSettings();
    return this.has(setting);
  }

  async updateMultipleSettings(
    updates: BitFieldResolvable<HubSettingsString, number>,
  ): Promise<void> {
    if (typeof updates === 'number') {
      this.settings = new HubSettingsBitField(updates);
      await this.saveSettings();
      return;
    }
    for (const [setting, value] of Object.entries(updates)) {
      if (value) this.settings.add(setting as HubSettingsString);
      else this.settings.remove(setting as HubSettingsString);
    }

    await this.saveSettings();
  }

  has(setting: HubSettingsString): boolean {
    return this.settings.has(setting);
  }

  getAll(): Record<HubSettingsString, boolean> {
    return this.settings.serialize();
  }

  getEmbed(client: Client): EmbedBuilder {
    const embed = new InfoEmbed()
      .setTitle('Hub Settings')
      .setColor(Constants.Colors.interchatBlue)
      .setDescription('Current settings for this hub:');

    for (const [key, value] of Object.entries(this.getAll())) {
      embed.addFields({
        name: key,
        value: value
          ? `${getEmoji('tick_icon', client)} Enabled`
          : `${getEmoji('x_icon', client)} Disabled`,
        inline: true,
      });
    }

    return embed;
  }

  private async saveSettings(): Promise<void> {
    await this.hub.update({ settings: this.settings.bitfield });
  }

  // Helper method to reset all settings to default
  async resetToDefault(): Promise<void> {
    this.settings = new HubSettingsBitField(0);
    await this.saveSettings();
  }

  // Helper method to enable all settings
  async enableAll(): Promise<void> {
    this.settings.add(Object.keys(HubSettingsBits) as HubSettingsString[]);

    await this.saveSettings();
  }

  // Helper method to disable all settings
  async disableAll(): Promise<void> {
    this.settings = new HubSettingsBitField(0);
    await this.saveSettings();
  }
}
