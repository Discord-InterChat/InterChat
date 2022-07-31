const { EmbedBuilder } = require('@discordjs/builders');
const logger = require('../../utils/logger');
const { clean, developers } = require('../../utils/functions/utils');
const { resolveColor } = require('discord.js');
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

			const start = Date.now();

			// Evaluate (execute) our input
			const evaled = eval(args.join(' '));

			// Put our eval result through the function
			// we defined above
			const cleaned = await clean(message.client, evaled);
			const stop = Date.now();

			// create a new embed
			const embed = new EmbedBuilder()
				.setTitle('Evaluation')
				.setColor(resolveColor('Blurple'))
				.setTimestamp();

			if (cleaned.length > 3950) {
				message.reply('Output too long to send. Logged to console. Check log file for more info.');
				return logger.info(`[Eval]: ${cleaned}`);
			}
			else if (cleaned.length >= 1024) {
				embed
					.setColor(resolveColor('Yellow'))
					.setDescription(`Due to discord's limitations only the output is shown.\n \`\`\`js\n${cleaned}\n\`\`\``);
			}
			else {
				embed.setFields([
					{ name: 'Input', value: `\`\`\`js\n${args.join(' ')}\n\`\`\``, inline: true },
					{ name: 'Execution Time:', value: `\`\`\`${stop - start}ms\`\`\``, inline: true },
					{ name: 'Output', value: `\`\`\`js\n${cleaned}\n\`\`\`` },
				]);
			}

			// if cleaned includes [REDACTED] then send a colored codeblock
			if (cleaned.includes('[REDACTED]')) embed.spliceFields(1, 1, { name: 'Output', value:  `\`\`\`ansi\n${cleaned}\n\`\`\` ` });

			// Reply in the channel with our result
			message.channel.send({ embeds: [embed] });
		}
		catch (err) {
			// Reply in the channel with our error
			logger.error(err);
			message.channel.send(`\`ERROR\` \`\`\`xl\n${err}\n\`\`\``);
		}

		// End of our command

	},
};