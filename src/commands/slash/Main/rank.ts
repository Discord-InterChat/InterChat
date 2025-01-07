import BaseCommand from '#main/core/BaseCommand.js';
import { calculateRequiredXP } from '#main/utils/calculateLevel.js';
import Constants from '#main/utils/Constants.js';
import { handleError } from '#main/utils/Utils.js';
import { CanvasRenderingContext2D, createCanvas, loadImage } from 'canvas';
import {
  ApplicationCommandOptionType,
  AttachmentBuilder,
  ChatInputCommandInteraction,
  RESTPostAPIChatInputApplicationCommandsJSONBody,
} from 'discord.js';
import { join } from 'node:path';

const drawProgressBar = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  progress: number,
  backgroundColor: string = '#484b4e',
  progressColor: string = Constants.Colors.interchatBlue,
) => {
  // Draw background
  ctx.fillStyle = backgroundColor;
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, height / 2);
  ctx.fill();

  // Draw progress
  const progressWidth = (width - 4) * Math.min(Math.max(progress, 0), 1);
  if (progressWidth > 0) {
    ctx.fillStyle = progressColor;
    ctx.beginPath();
    ctx.roundRect(x + 2, y + 2, progressWidth, height - 4, (height - 4) / 2);
    ctx.fill();
  }
};

export default class Rank extends BaseCommand {
  readonly data: RESTPostAPIChatInputApplicationCommandsJSONBody = {
    name: 'rank',
    description: 'ur rank lol',
    options: [
      {
        name: 'user',
        description: 'The user to get the rank of',
        type: ApplicationCommandOptionType.User,
        required: false,
      },
    ],
  };
  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    const targetUser = interaction.options.getUser('user') ?? interaction.user;
    const stats = await interaction.client.userLevels.getStats(targetUser.id);

    // Create canvas
    const width = 900;
    const height = 250;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    try {
      // Load and draw background
      const background = await loadImage(join(__dirname, '../../../../assets/rankBg.png'));
      ctx.drawImage(background, 0, 0, width, height);

      // Add semi-transparent overlay
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(0, 0, width, height);

      // Load and draw user avatar
      const avatar = await loadImage(targetUser.displayAvatarURL({ extension: 'png', size: 256 }));
      const avatarSize = 110;
      const avatarX = 40;
      const avatarY = (height - avatarSize) / 2 - 20;

      // Draw avatar background/border
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(
        avatarX + avatarSize / 2,
        avatarY + avatarSize / 2,
        avatarSize / 2 + 5,
        0,
        Math.PI * 2,
      );
      ctx.fill();

      // Create circular avatar
      ctx.save();
      ctx.beginPath();
      ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(avatar, avatarX, avatarY, avatarSize, avatarSize);
      ctx.restore();

      // Draw username
      ctx.font = 'bold 32px "Arial"';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(targetUser.username, avatarX + avatarSize + 30, avatarY + 40);

      // Draw level
      ctx.font = 'bold 28px "Arial"';
      ctx.fillStyle = Constants.Colors.interchatBlue;
      ctx.fillText(`Level ${stats.level}`, avatarX + avatarSize + 30, avatarY + 80);

      // Draw rank
      const rankText = `Rank #${stats.stats.xp.rank}`;
      ctx.font = 'bold 28px "Arial"';
      const rankWidth = ctx.measureText(rankText).width;
      ctx.fillText(rankText, width - 40 - rankWidth, avatarY + 40);

      // Draw messages
      const messageText = `${stats.messageCount} messages`;
      const messageWidth = ctx.measureText(messageText).width;
      ctx.fillText(messageText, width - 40 - messageWidth, avatarY + 80);

      // Draw XP progress bar
      const currentLevelXP = stats.xp % calculateRequiredXP(stats.level);
      const requiredXP = calculateRequiredXP(stats.level);
      const progress = currentLevelXP / requiredXP;

      const barWidth = width - (avatarX + avatarSize + 60) - 40;
      drawProgressBar(ctx, avatarX + avatarSize + 30, avatarY + 100, barWidth, 25, progress);

      // Draw XP text
      ctx.font = '20px "Arial"';
      ctx.fillStyle = '#ffffff';
      const xpText = `${currentLevelXP} / ${requiredXP} XP`;
      const xpWidth = ctx.measureText(xpText).width;
      ctx.fillText(xpText, avatarX + avatarSize + 30 + (barWidth - xpWidth) / 2, avatarY + 118);

      // Draw total XP
      ctx.font = '24px "Arial"';
      const totalXPText = `Total XP: ${stats.xp}`;
      ctx.fillText(totalXPText, avatarX + avatarSize + 30, avatarY + 160);

      // Create attachment
      const attachment = new AttachmentBuilder(canvas.toBuffer(), { name: 'rank.png' });

      // Send the rank card
      await interaction.editReply({ files: [attachment] });
    }
    catch (error) {
      handleError(error, { comment: 'Failed to create rank card', repliable: interaction });
    }
  }
}
