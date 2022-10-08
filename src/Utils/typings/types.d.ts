import { WithId, Document } from 'mongodb';

export interface messageData extends WithId<Document> {
	channelAndMessageIds: {channelId: string, messageId: string}[],
	timestamp: number;
	authorId: string;
	serverId: string;
	expired: boolean;
}

export interface connectedListDocument extends WithId<Document> {
	channelId: string,
	channelName: string,
	serverId: string,
	serverName: string
}

declare global {
	interface String {
		/** Converts every word in a sentense to begin with a capital letter. */
		toTitleCase(): string;
	}
}