export interface WebhookPayload {
  /** If webhook is a bot: ID of the bot that received a vote */
  bot?: Snowflake;
  /** If webhook is a server: ID of the server that received a vote */
  guild?: Snowflake;
  /** ID of the user who voted */
  user: Snowflake;
  /**
   * The type of the vote (should always be "upvote" except when using the test
   * button it's "test")
   */
  type: 'upvote' | 'test';
  /**
   * Whether the weekend multiplier is in effect, meaning users votes count as
   * two
   */
  isWeekend?: boolean;
  /** Query parameters in vote page in a key to value object */
  query:
    | {
      [key: string]: string;
    }
    | string;
}
