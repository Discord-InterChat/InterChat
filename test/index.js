const logger = require('../logger');
const mongoUtil = require('../utils');

// eslint-disable-next-line no-unused-vars
mongoUtil.connect((err, mongoClient) => {
	if (err) console.log(err);
	logger.info('Connected to MongoDB');
});
setTimeout(() => {
	mongo().catch(console.error);
}, 1000);
async function mongo() {
	const database = await mongoUtil.getDb();
	const blacklistedServers = await database.collection('blacklistedServers');
	const searchCursor = await blacklistedServers.find();
	const result = await searchCursor.toArray();
	// console.table(result);
	// console.log(result[1].serverId);
	for (let i = 0; i < result.length; i++) {
		console.log(`ID: ${result[i]._id}\nserverID: ${result[i].serverId}\nReason: ${result[i].reason}`);
		// console.log(result[i]._id);
		// console.log(result[i].serverId);
		// console.log(result[i].reason);

	}

	// for (let i = 0; i < result.length; i++) {
	// 	for (const [key, value] of Object.entries(result[i])) {
	// 		console.log(`${key}: ${value}`);
	// 	}
	// 	// for (const key of Object.keys(result[i])) {
	// 	// 	console.log(`${key}: ${result[i][key]}`);
	// 	// }
	// }
}

