import express from 'express';
import Levels from 'discord-xp';
import { ChatBot } from './Structures/client';

const app = express();
const client = new ChatBot();

app.listen(process.env.PORT || 8080);
app.get('/', (_req, res) => res.send('Acknowledged'));
Levels.setURL(process.env.MONGODB_URI as string);


client.start();