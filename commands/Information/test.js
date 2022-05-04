const { SlashCommandBuilder } = require('@discordjs/builders');
module.exports = {
	data: new SlashCommandBuilder()
		.setName('test')
		.setDescription('Sends the credits for the bot.'),
	async execute(interaction) {

		// Working fetch:
		/*
		const guild = await interaction.client.guilds.fetch('969920027421732874');
		const member = await guild.members.fetch(interaction.user.id);
		const roles = await member._roles;
		const staff = '970713237748318268';
		const developer = '970706750229586010';

		if (roles.includes(developer)) return interaction.reply('dev');
		else if (roles.includes(staff)) return interaction.reply('staff');
		*/


		const devs = ['701727675311587358', '748190663597883392', '736482645931720765', '828492978716409856'];
		const staff = ['442653948630007808', '446709111715921920'];

		const guilds = await interaction.client.guilds.fetch('969920027421732874');
		guilds.members.fetch('66564597481480192')
			.then(console.log)
			.catch(console.error);


		if (interaction.client.guilds.cache.get('969920027421732874').members.fetch(interaction.user.id).roles.fetch(role => role.id === '970706750229586010')) {
			interaction.reply('Developer.');
			return;
		}
		if (interaction.client.guilds.cache.get('969920027421732874').members.cache.get(interaction.user.id).roles.cache.some(role => role.id === '970713237748318268')) {
			interaction.reply('Staff.');
			return;
		}

		if (interaction.member.roles.cache.some(role => role.id === '970706750229586010')) {
			interaction.reply('User has role');
		}
		else {interaction.reply('Nah he dont got the role D:');}

		if (devs.includes(interaction.member.id)) {
			interaction.reply('U in devs array');
		}
		else if (staff.includes(interaction.member.id)) {
			interaction.reply('U in Staff array');
		}
		else {
			interaction.reply({ content: 'You don\'t have permissions to run this command.', ephemeral: true });
		}
	},
};

// TO-DO: Get user roles for chatbot guild then set perms for staff command lel (DONE)
