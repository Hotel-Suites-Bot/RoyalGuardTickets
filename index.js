require('dotenv').config();

const { 
  Client, 
  GatewayIntentBits, 
  Partials,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ChannelType,
  PermissionsBitField
} = require('discord.js');

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
  partials: [Partials.Channel]
});

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

// PANEL COMMAND
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'panel') {
    const menu = new StringSelectMenuBuilder()
      .setCustomId('ticket_select')
      .setPlaceholder('Select a ticket type')
      .addOptions([
        { label: 'In-Game Assistance', value: 'ingame' },
        { label: 'Game Development', value: 'dev' },
        { label: 'DMI Reports', value: 'dmi' }
      ]);

    const row = new ActionRowBuilder().addComponents(menu);

    await interaction.reply({
      content: 'Select a ticket type:',
      components: [row]
    });
  }
});

// MENU HANDLER
client.on('interactionCreate', async interaction => {
  if (!interaction.isStringSelectMenu()) return;

  if (interaction.customId === 'ticket_select') {

    let roleId;
    if (interaction.values[0] === 'ingame') roleId = process.env.ROLE_INGAME;
    if (interaction.values[0] === 'dev') roleId = process.env.ROLE_DEV;
    if (interaction.values[0] === 'dmi') roleId = process.env.ROLE_DMI;

    const channel = await interaction.guild.channels.create({
      name: `ticket-${interaction.user.username}`,
      type: ChannelType.GuildText,
      parent: process.env.TICKET_CATEGORY,
      permissionOverwrites: [
        {
          id: interaction.guild.id,
          deny: [PermissionsBitField.Flags.ViewChannel]
        },
        {
          id: interaction.user.id,
          allow: [PermissionsBitField.Flags.ViewChannel]
        },
        {
          id: roleId,
          allow: [PermissionsBitField.Flags.ViewChannel]
        }
      ]
    });

    await interaction.reply({
      content: `Ticket created: ${channel}`,
      ephemeral: true
    });

    channel.send(`Welcome ${interaction.user}`);
  }
});

client.login(process.env.TOKEN);
