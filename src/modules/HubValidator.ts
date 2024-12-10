import HubManager from '#main/managers/HubManager.js';
import { HubService, type HubCreationData } from '#main/services/HubService.js';
import Constants, { emojis } from '#main/utils/Constants.js';
import { supportedLocaleCodes, t } from '#main/utils/Locale.js';

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

export class HubValidator {
  private readonly locale: supportedLocaleCodes;
  private readonly hubService = new HubService();

  constructor(locale: supportedLocaleCodes) {
    this.locale = locale;
  }

  private static readonly MAX_HUBS_PER_USER = 3;

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
        error: t('hub.create.invalidName', this.locale, { emoji: emojis.no }),
      };
    }
    return { isValid: true };
  }

  private async validateUniqueName(name: string): Promise<ValidationResult> {
    const existingHub = await this.hubService.fetchHub({ name });
    if (existingHub) {
      return {
        isValid: false,
        error: t('hub.create.nameTaken', this.locale, { emoji: emojis.no }),
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
        error: t('hub.create.maxHubs', this.locale, { emoji: emojis.no }),
      };
    }
    return { isValid: true };
  }

  private validateImages(iconUrl?: string, bannerUrl?: string): ValidationResult {
    const imgurRegex = Constants.Regex.ImgurImage;

    if ((iconUrl && !imgurRegex.test(iconUrl)) || (bannerUrl && !imgurRegex.test(bannerUrl))) {
      return {
        isValid: false,
        error: t('hub.invalidImgurUrl', this.locale, { emoji: emojis.no }),
      };
    }
    return { isValid: true };
  }
}