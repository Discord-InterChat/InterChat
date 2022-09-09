import { WithId, Document } from 'mongodb';

export interface messageData extends WithId<Document>{
	channelAndMessageIds: Array<{
		channelId: string,
		messageId: string
	}>,
	timestamp: number,
	authorId: string,
	serverId: string
}

export interface connectedListInterface extends WithId<Document> {
	channelId: string,
	channelName: string,
	serverId: string,
	serverName: string
}