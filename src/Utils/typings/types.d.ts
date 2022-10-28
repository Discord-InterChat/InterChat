import { MessageReference } from 'discord.js';
import { WithId, Document } from 'mongodb';

export interface messageData extends WithId<Document> {
	channelAndMessageIds: {channelId: string; messageId: string}[];
	timestamp: number;
	authorId: string;
	serverId: string;
	/** Message reference data */
	reference: MessageReference | null;
	expired: boolean;
}

export interface connectedListDocument extends WithId<Document> {
	channelId: string;
	channelName: string;
	serverId: string;
	serverName: string;
}

export interface setupDocument extends WithId<Document> {
	guild: {
		name: string;
		id: string;
	},
	channel: {
		name: string;
		id: string;
	},
	date: {
		full: Date
		timestamp: number;
	},
	compact: boolean;
	profFilter: boolean;
}

declare global {
	interface String {
		/** Converts every word in a sentense to begin with a capital letter. */
		toTitleCase(): string;
	}
}