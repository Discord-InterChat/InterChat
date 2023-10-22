import { Collection } from 'discord.js';

/** A service to manage cooldowns */
export default class CooldownService {
  private readonly cooldowns: Collection<string, number>;

  constructor() {
    this.cooldowns = new Collection<string, number>();

    setInterval(() => {
      this.cooldowns.forEach((expires, key) => {
        if (expires < Date.now()) this.cooldowns.delete(key);
      });
    }, 60 * 1000);
  }

  /**
   * Set a cooldown
   * @param id A unique id for the cooldown
   * @param ms The duration of the cooldown in milliseconds
   */
  public setCooldown(id: string, ms: number): void {
    this.cooldowns.set(id, Date.now() + ms);
  }

  /** Get a cooldown */
  public getCooldown(id: string) {
    return this.cooldowns.get(id);
  }

  /** Delete a cooldown */
  public deleteCooldown(id: string): void {
    this.cooldowns.delete(id);
  }

  /** Get the remaining cooldown in milliseconds */
  public getRemainingCooldown(id: string): number {
    const cooldown = this.getCooldown(id);
    if (!cooldown) return 0;
    return cooldown - Date.now();
  }
}
