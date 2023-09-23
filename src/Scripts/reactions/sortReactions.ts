export default {
  execute(reactions: Record<string, string[]>) {
  // Sort the array based on the reaction counts
  /* { '👍': ['10201930193'], '👎': ['10201930193'] } // before Object.entries
     => [ [ '👎', ['10201930193'] ], [ '👍', ['10201930193'] ] ] // after Object.entries
  */
    return Object.entries(reactions).sort((a, b) => b[1].length - a[1].length);
  },
};