import { PrismaClient, AchievementType } from '@prisma/client';

const db = new PrismaClient();

export default db;

export async function createAchievement(userId: string, type: AchievementType) {
  return await db.achievement.create({
    data: {
      userId,
      type,
    },
  });
}

export async function getAchievements(userId: string) {
  return await db.achievement.findMany({
    where: {
      userId,
    },
  });
}

export async function createUserAchievement(userId: string, achievementId: string) {
  return await db.userAchievement.create({
    data: {
      userId,
      achievementId,
    },
  });
}

export async function getUserAchievements(userId: string) {
  return await db.userAchievement.findMany({
    where: {
      userId,
    },
  });
}
