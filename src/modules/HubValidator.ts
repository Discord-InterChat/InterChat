import type { Client } from 'discord.js';
import type HubManager from '#main/managers/HubManager.js';
import { type HubCreationData, HubService } from '#main/services/HubService.js';
import Constants from '#main/utils/Constants.js';
import { type EmojiKeys, getEmoji } from '#main/utils/EmojiUtils.js';
import { type supportedLocaleCodes, t } from '#main/utils/Locale.js';

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

export class HubValidator {
  private readonly locale: supportedLocaleCodes;
  private readonly hubService = new HubService();
  private readonly client: Client;

  constructor(locale: supportedLocaleCodes, client: Client) {
    this.locale = locale;
    this.client = client;
  }

  private static readonly MAX_HUBS_PER_USER = 3;

  private getEmoji(name: EmojiKeys): string {
    return getEmoji(name, this.client);
  }

  async validateNewHub(
    data: HubCreationData,
    existingHubs: HubManager[],
  ): Promise<ValidationResult> {
    const nameValidation = this.validateHubName(data.name);
    if (!nameValidation.isValid) return nameValidation;

    const uniqueNameValidation = await this.validateUniqueName(data.name);
    if (!uniqueNameValidation.isValid) return uniqueNameValidation;

    const hubLimitValidation = this.validateHubLimit(data.ownerId, existingHubs);
    if (!hubLimitValidation.isValid) return hubLimitValidation;

    const imageValidation = this.validateImages(data.iconUrl, data.bannerUrl);
    if (!imageValidation.isValid) return imageValidation;

    return { isValid: true };
  }

  private validateHubName(name: string): ValidationResult {
    if (Constants.Regex.BannedWebhookWords.test(name)) {
      return {
        isValid: false,
        error: t('hub.create.invalidName', this.locale, {
          emoji: this.getEmoji('x_icon'),
        }),
      };
    }
    return { isValid: true };
  }

  private async validateUniqueName(name: string): Promise<ValidationResult> {
    const existingHub = await this.hubService.fetchHub({ name });
    if (existingHub) {
      return {
        isValid: false,
        error: t('hub.create.nameTaken', this.locale, {
          emoji: this.getEmoji('x_icon'),
        }),
      };
    }
    return { isValid: true };
  }

  private validateHubLimit(ownerId: string, existingHubs: HubManager[]): ValidationResult {
    const userHubCount = existingHubs.reduce(
      (acc, hub) => (hub.isOwner(ownerId) ? acc + 1 : acc),
      0,
    );

    if (userHubCount >= HubValidator.MAX_HUBS_PER_USER) {
      return {
        isValid: false,
        error: t('hub.create.maxHubs', this.locale, {
          emoji: this.getEmoji('x_icon'),
        }),
      };
    }
    return { isValid: true };
  }

  private validateImages(iconUrl?: string, bannerUrl?: string): ValidationResult {
    const imgurRegex = Constants.Regex.ImgurImage;

    if ((iconUrl && !imgurRegex.test(iconUrl)) || (bannerUrl && !imgurRegex.test(bannerUrl))) {
      return {
        isValid: false,
        error: t('hub.invalidImgurUrl', this.locale, {
          emoji: this.getEmoji('x_icon'),
        }),
      };
    }
    return { isValid: true };
  }
}
