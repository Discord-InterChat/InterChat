import Levels from 'discord-xp';
import { ChatBot } from './Structures/client';
Levels.setURL(process.env.MONGODB_URI as string);

const client = new ChatBot();

client.start();