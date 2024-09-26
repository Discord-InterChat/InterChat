/**
 * Sorts the reactions object based on the reaction counts.
 * @param reactions - The reactions object to be sorted.
 * @returns The sorted reactions object in the form of an array.
 * The array is sorted in descending order based on the length of the reaction arrays.
 * Each element of the array is a tuple containing the reaction and its corresponding array of user IDs.
 *
 * **Before:**
 * ```ts
 *  { '👍': ['10201930193'], '👎': ['10201930193', '10201930194'] }
 * ```
 * **After:**
 * ```ts
 * [ [ '👎', ['10201930193', '10201930194'] ], [ '👍', ['10201930193'] ] ]
 * ```
 * */
export default (reactions: { [key: string]: string[] }): [string, string[]][] => {
  const idk = Object.entries(reactions).sort((a, b) => b[1].length - a[1].length);
  return idk;
};
