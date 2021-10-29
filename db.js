const logger = require('./logger');
const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');

dotenv.config();

const uri = process.env.MONGODB_URI;
const dbClient = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

dbClient.connect(async err => {
	if (err) {
		logger.error(err);
	}
	const database = dbClient.db('servers');
	const channelList = database.collection('channel_list');

	const findResult = await channelList.find({});
	findResult.forEach(console.dir);

});