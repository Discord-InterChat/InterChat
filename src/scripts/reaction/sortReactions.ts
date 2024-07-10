/**
 * Sorts the reactions object based on the reaction counts.
 * @param reactions - The reactions object to be sorted.
 * @returns The sorted reactions object in the form of an array.
 * The array is sorted in descending order based on the length of the reaction arrays.
 * Each element of the array is a tuple containing the reaction and its corresponding array of user IDs.
 *
 * ### Example:
 * ```js
 * [ [ '👎', ['1020193019332334'] ], [ '👍', ['1020193019332334'] ] ]
 * ```
 */
export default (reactions: { [key: string]: string[] }) =>
  Object.entries(reactions).sort((a, b) => b[1].length - a[1].length);
