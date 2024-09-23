import { BitField } from 'discord.js';

export const HubSettingsBits = {
  Reactions: 1 << 0,
  HideLinks: 1 << 1,
  SpamFilter: 1 << 2,
  BlockInvites: 1 << 3,
  UseNicknames: 1 << 4,
  BlockNSFW: 1 << 5,
} as const;


export type HubSettingsString = keyof typeof HubSettingsBits;
export type SerializedHubSettings = Record<HubSettingsString, boolean>;

export class HubSettingsBitField extends BitField<HubSettingsString> {
  public static Flags = HubSettingsBits;

  /**
   * Toggles the specified hub settings.
   * If the settings are already present, they will be removed.
   * If the settings are not present, they will be added.
   * @param setting - The hub settings to toggle.
   * @returns The updated hub settings.
   */
  public toggle(...setting: HubSettingsString[]) {
    return this.has(setting) ? this.remove(setting) : this.add(setting);
  }
}
