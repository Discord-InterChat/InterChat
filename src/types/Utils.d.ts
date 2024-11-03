export type ReactionArray = { [key: string]: Snowflake[] };
export type RemoveMethods<T> = {
  [K in keyof T]: T[K] extends (...args: unknown[]) => unknown ? never : RemoveMethods<T[K]>;
};

export type ThreadParentChannel = NewsChannel | TextChannel | ForumChannel | MediaChannel;

export type ConvertDatesToString<T> = T extends Date
  ? string
  : T extends Array<infer U>
    ? Array<ConvertDatesToString<U>>
    : T extends object
      ? { [K in keyof T]: ConvertDatesToString<T[K]> }
      : T;
