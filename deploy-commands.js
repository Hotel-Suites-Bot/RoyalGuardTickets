require('dotenv').config();
const { REST, Routes, SlashCommandBuilder } = require('discord.js');

const commands = [
  new SlashCommandBuilder()
    .setName('panel')
    .setDescription('Send the ticket panel'),

  new SlashCommandBuilder()
    .setName('escalate')
    .setDescription('Escalate a ticket')
    .addRoleOption(option =>
      option.setName('role')
        .setDescription('Role to escalate to')
        .setRequired(true)
    )
].map(cmd => cmd.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

(async () => {
  try {
    console.log('Deploying slash commands...');

    await rest.put(
      Routes.applicationGuildCommands(
        process.env.CLIENT_ID,
        process.env.GUILD_ID
      ),
      { body: commands }
    );

    console.log('Commands deployed successfully');
  } catch (err) {
    console.error(err);
  }
})();
