const { EmbedBuilder } = require('@discordjs/builders');
const logger = require('../../logger');
const { clean } = require('../../utils');
module.exports = {
	async execute(message) {
		// The actual eval command
		message.content = message.content.replace(/```js|```/g, '');

		// Get our input arguments
		const args = message.content.split(' ').slice(1);

		// If the message author's ID does not equal
		// our ownerID, get outta there!
		// eslint-disable-next-line no-undef
		if (!developers.includes(BigInt(message.author.id))) return;

		// In case something fails, we to catch errors
		// in a try/catch block
		try {
			// Evaluate (execute) our input
			const evaled = eval(args.join(' '));

			// Put our eval result through the function
			// we defined above
			const cleaned = await clean(message.client, evaled);


			// create a new embed
			const embed = new EmbedBuilder()
				.setTitle('Evaluation')
				.setFields([
					{ name: 'Input', value: `\`\`\`js\n${args.join(' ')}\n\`\`\`` },
					{ name: 'Output', value: `\`\`\`js\n${cleaned}\n\`\`\`` },
				])
				.setColor('Blurple')
				.setTimestamp();

			// if cleaned includes [REDACTED] then send a colored codeblock
			if (cleaned.includes('[REDACTED]')) embed.spliceFields(1, 1, { name: 'Output', value:  `\`\`\`ansi\n${cleaned}\n\`\`\` ` });


			if (embed.length > 6000) {
				message.reply('Output too long to send. Logged to console. Check log file for more info.');
				return logger.info(`[Eval]: ${args.join(' ')}`);
			}

			// Reply in the channel with our result
			message.channel.send({ embeds: [embed] });
		}
		catch (err) {
			// Reply in the channel with our error
			message.channel.send(`\`ERROR\` \`\`\`xl\n${err}\n\`\`\``);
		}

		// End of our command

	},
};