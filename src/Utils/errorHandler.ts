import { DiscordAPIError } from 'discord.js';


export function formatErrorCode(error: any) {
  let errorMessage = 'An unexpected error occurred while processing your request.';

  if (error instanceof DiscordAPIError) {
    switch (error.code) {
      case 50001:
        errorMessage = 'I do not have permission to do that.';
        break;
      case 50013:
        errorMessage = 'You do not have permission to do that.';
        break;
      case 50034:
        errorMessage = 'I am unable to purge messages older than 14 days.';
        break;

      default:
        break;
    }
  }

  return errorMessage;
}
