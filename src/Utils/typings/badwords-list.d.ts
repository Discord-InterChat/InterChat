declare module 'badwords-list' {
	export = badwords_list;

	const badwords_list: {
		array: string[];
		object: object;
		regex: RegExp;
	};
}