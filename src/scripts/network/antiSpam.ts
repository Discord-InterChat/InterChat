import { Collection, User } from 'discord.js';

interface AntiSpamUserOpts {
  timestamps: number[];
  infractions: number;
}

export const antiSpamMap = new Collection<string, AntiSpamUserOpts>();

const WINDOW_SIZE = 5000;
const MAX_STORE = 3;

/**
 * Sets spam timers for a given user.
 * @param userId - The ID of the user to set spam timers for.
 * @returns void
 */
export const setSpamTimers = (user: User) => {
  const five_min = 60 * 5000;
  const userInCol = antiSpamMap.get(user.id);
  const scheduler = user.client.getScheduler();
  const lastMsgTimestamp = userInCol?.timestamps[userInCol.timestamps.length - 1];

  if (lastMsgTimestamp && Date.now() - five_min <= lastMsgTimestamp) {
    scheduler.stopTask(`removeFromCol_${user.id}`);
  }

  scheduler.addRecurringTask(`removeFromCol_${user.id}`, new Date(Date.now() + five_min), () => {
    antiSpamMap.delete(user.id);
  });
};

/**
 * Runs the anti-spam mechanism for a given user.
 * @param author - The user to run the anti-spam mechanism for.
 * @param maxInfractions - The maximum number of infractions before the user is blacklisted.
 * @returns The user's anti-spam data if they have reached the maximum number of infractions, otherwise undefined.
 */
export const runAntiSpam = (author: User, maxInfractions = MAX_STORE) => {
  const userInCol = antiSpamMap.get(author.id);
  const currentTimestamp = Date.now();

  if (!userInCol) {
    antiSpamMap.set(author.id, {
      timestamps: [currentTimestamp],
      infractions: 0,
    });
    setSpamTimers(author);
    return null;
  }

  // resetting count as it is assumed they will be blacklisted right after
  if (userInCol.infractions >= maxInfractions) {
    antiSpamMap.delete(author.id);
    return userInCol;
  }

  const { timestamps } = userInCol;

  // Check if all the timestamps are within the window
  if (timestamps.length === MAX_STORE) {
    const [oldestTimestamp] = timestamps;
    const isWithinWindow = currentTimestamp - oldestTimestamp <= WINDOW_SIZE;

    antiSpamMap.set(author.id, {
      timestamps: [...timestamps.slice(1), currentTimestamp],
      infractions: isWithinWindow ? userInCol.infractions + 1 : userInCol.infractions,
    });
    setSpamTimers(author);
    if (isWithinWindow) return userInCol;
  }
  else {
    antiSpamMap.set(author.id, {
      timestamps: [...timestamps, currentTimestamp],
      infractions: userInCol.infractions,
    });
  }
  return null;
};
