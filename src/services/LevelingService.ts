import db from '#main/utils/Db.js';
import { PrismaClient } from '@prisma/client';
import { Colors, Message, TextChannel } from 'discord.js';
import { calculateRequiredXP } from '#main/utils/calculateLevel.js';

export class LevelingService {
  private db: PrismaClient;
  private xpCooldowns: Map<string, Date>;

  constructor(prisma?: PrismaClient) {
    this.db = prisma ?? db;
    this.xpCooldowns = new Map();
  }

  private isUserOnCooldown(userId: string): boolean {
    const lastMessage = this.xpCooldowns.get(userId);

    if (!lastMessage) return false;

    const cooldownTime = 5 * 1000; // 5 seconds cooldown
    return Date.now() - lastMessage.getTime() < cooldownTime;
  }

  private async createUser(userId: string) {
    return await this.db.userData.create({
      data: { id: userId },
    });
  }

  private async getOrCreateUser(userId: string) {
    let user = await this.db.userData.findUnique({
      where: { id: userId },
    });

    if (!user) {
      user = await this.createUser(userId);
    }

    return user;
  }

  private generateXP(): number {
    // Reduced XP gain: 3-8 XP per message
    return Math.floor(Math.random() * (8 - 3 + 1)) + 3;
  }

  public async handleMessage(message: Message<true>): Promise<void> {
    if (message.author.bot) return;

    const userId = message.author.id;

    if (this.isUserOnCooldown(userId)) return;

    const user = await this.getOrCreateUser(userId);
    const earnedXP = this.generateXP();
    const currentLevel = user.level;
    const requiredXP = calculateRequiredXP(currentLevel);

    // Calculate XP within the current level
    const currentLevelXP = user.xp % requiredXP;
    let newXP = currentLevelXP + earnedXP;
    let newLevel = currentLevel;
    const totalXP = user.xp + earnedXP;

    // Check for level up
    if (newXP >= requiredXP) {
      newLevel = currentLevel + 1;
      // Reset XP for the new level, keeping overflow
      newXP = newXP - requiredXP;
      await this.sendLevelUpMessage(message.channel as TextChannel, message.author, newLevel);
    }

    await this.db.userData.update({
      where: { id: userId },
      data: {
        xp: totalXP, // Keep track of total XP earned
        level: newLevel,
        messageCount: { increment: 1 },
        lastMessageAt: new Date(),
      },
    });

    // TODO: Uncomment after adding server leaderboard
    // await this.db.serverData.upsert({
    //   where: { id: message.guildId },
    //   create: { id: message.guildId },
    //   update: { messageCount: { increment: 1 }, lastMessageAt: new Date() },
    // });

    this.xpCooldowns.set(userId, new Date());
  }

  private async sendLevelUpMessage(
    channel: TextChannel,
    user: Message['author'],
    newLevel: number,
  ): Promise<void> {
    await channel.send({
      embeds: [
        {
          title: '🎉 Level Up!',
          description: `Congratulations ${user}! You've reached level ${newLevel}!`,
          color: Colors.Green,
        },
      ],
    });
  }

  public async getStats(userId: string) {
    const user = await this.getOrCreateUser(userId);
    const stats = {
      xp: {
        rank:
          (await this.db.userData.count({
            where: {
              xp: { gt: user.xp },
            },
          })) + 1,
      },
      level: {
        rank:
          (await this.db.userData.count({
            where: {
              level: { gt: user.level },
            },
          })) + 1,
      },
      messages: {
        rank:
          (await this.db.userData.count({
            where: {
              messageCount: { gt: user.messageCount },
            },
          })) + 1,
      },
    };

    return {
      ...user,
      stats,
      requiredXP: calculateRequiredXP(user.level),
    };
  }

  public async getLeaderboard(type: 'xp' | 'level' | 'messages' = 'xp', limit = 10) {
    const orderBy = {
      xp: { xp: 'desc' as const },
      level: { level: 'desc' as const },
      messages: { messageCount: 'desc' as const },
    }[type];

    return await this.db.userData.findMany({
      orderBy,
      take: limit,
    });
  }
}
