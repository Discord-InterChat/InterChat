import UserDbService from '#src/services/UserDbService.js';
import getRedis from '#src/utils/Redis.js';
import { RedisKeys } from '#utils/Constants.js';

export default class VoteLimitManager {
  private readonly userId;
  private readonly limitObjKey;
  private readonly userManager: UserDbService;

  private readonly MAX_USES_WITHOUT_VOTE;
  private readonly CACHE_DURATION; // 12 hours

  constructor(
    limitObjKey: string,
    userId: string,
    opts?: { maxUses?: number; cacheDuration?: number },
  ) {
    this.limitObjKey = limitObjKey;
    this.userId = userId;
    this.userManager = new UserDbService();
    this.MAX_USES_WITHOUT_VOTE = opts?.maxUses ?? 3;
    this.CACHE_DURATION = opts?.cacheDuration ?? 43200; // 12 hours
  }

  public async getRemainingUses() {
    const rawData = await getRedis().get(
      `${RedisKeys.commandUsesLeft}:${this.limitObjKey}:${this.userId}`,
    );

    return Number.isNaN(Number(rawData)) ? null : Number(rawData);
  }

  public async setRemainingUses(remainingUses: number, expirySecs?: number) {
    return await getRedis().set(
      `${RedisKeys.commandUsesLeft}:${this.limitObjKey}:${this.userId}`,
      JSON.stringify(remainingUses),
      'EX',
      expirySecs ?? this.CACHE_DURATION,
    );
  }

  public async decrementUses() {
    const usesLeft = await this.getRemainingUses();

    // Default to max edits if there's no data
    const newUsesCount =
			usesLeft !== null
			  ? Math.max(usesLeft - 1, 0)
			  : this.MAX_USES_WITHOUT_VOTE;

    // If from cache, don't overrite the duration
    const expirySecs = usesLeft === null ? this.CACHE_DURATION : undefined;
    await this.setRemainingUses(newUsesCount, expirySecs);

    return newUsesCount;
  }

  public async hasExceededLimit() {
    const usesLeft = await this.getRemainingUses();

    if (usesLeft === null) {
      const dbUser = await this.userManager.getUser(this.userId);

      const voteExpirySecs =
				dbUser?.lastVoted && dbUser.lastVoted.getTime() > Date.now()
				  ? Math.floor((dbUser.lastVoted.getTime() - Date.now()) / 1000)
				  : null;

      await this.setRemainingUses(
        this.MAX_USES_WITHOUT_VOTE,
        voteExpirySecs || this.CACHE_DURATION,
      );
    }
    else if (usesLeft === 0) {
      const hasVoted = await this.userManager.userVotedToday(this.userId);
      return !hasVoted;
    }

    return false;
  }
}
