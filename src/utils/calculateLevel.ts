export const calculateRequiredXP = (level: number): number =>
  Math.floor(100 * Math.pow(level, 2));
