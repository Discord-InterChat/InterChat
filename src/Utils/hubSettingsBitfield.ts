import { BitField } from 'discord.js';

export const HubSettingsBits = {
  Reactions: 1 << 0,
  HideLinks: 1 << 1,
  SpamFilter: 1 << 2,
  BlockInvites: 1 << 3,
  UseNicknames: 1 << 4,
} as const;

export type HubSettingsString = keyof typeof HubSettingsBits;

export class HubSettingsBitField extends BitField<HubSettingsString> {
  public static Flags = HubSettingsBits;
  /** toggle a setting */
  public toggle(...setting: HubSettingsString[]) {
    return this.has(setting) ? this.remove(setting) : this.add(setting);
  }
}
