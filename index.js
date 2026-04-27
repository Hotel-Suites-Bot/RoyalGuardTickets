require('dotenv').config();
const {
  Client,
  GatewayIntentBits,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ChannelType,
  PermissionsBitField,
  SlashCommandBuilder,
  REST,
  Routes,
  EmbedBuilder
} = require('discord.js');

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

// SIMPLE MEMORY COUNTER (can upgrade to DB later)
let counters = {
  ingame: 0,
  dmi: 0,
  dev: 0
};

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

// DEPLOY COMMANDS ON START (optional but useful)
const commands = [
  new SlashCommandBuilder()
    .setName('panel')
    .setDescription('Send ticket panel'),

  new SlashCommandBuilder()
    .setName('escalate')
    .setDescription('Escalate a ticket')
    .addRoleOption(option =>
      option.setName('role')
        .setDescription('Role to escalate to')
        .setRequired(true)
    )
].map(c => c.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

(async () => {
  await rest.put(
    Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
    { body: commands }
  );
})();

// PANEL
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'panel') {
    const menu = new StringSelectMenuBuilder()
      .setCustomId('ticket_select')
      .setPlaceholder('Select Ticket Type')
      .addOptions([
        { label: 'Ingame Support', value: 'ingame' },
        { label: 'Player Report', value: 'dmi' },
        { label: 'Developer Support', value: 'dev' }
      ]);

    const row = new ActionRowBuilder().addComponents(menu);

    await interaction.reply({
      content: 'Open a ticket below:',
      components: [row]
    });
  }

  // ESCALATE COMMAND
  if (interaction.commandName === 'escalate') {
    const role = interaction.options.getRole('role');

    await interaction.channel.permissionOverwrites.edit(role.id, {
      ViewChannel: true
    });

    const embed = new EmbedBuilder()
      .setDescription(`🔺 Ticket escalated to ${role}`)
      .setFooter({ text: process.env.FOOTER_TEXT });

    await interaction.reply({ embeds: [embed] });
  }
});

// TICKET CREATION
client.on('interactionCreate', async interaction => {
  if (!interaction.isStringSelectMenu()) return;

  if (interaction.customId === 'ticket_select') {

    let type = interaction.values[0];
    counters[type]++;

    let roleId;
    if (type === 'ingame') roleId = process.env.ROLE_SUPPORT;
    if (type === 'dmi') roleId = process.env.ROLE_DMI;
    if (type === 'dev') roleId = process.env.ROLE_DEV;

    const ticketName = `${type}-${counters[type]}`;

    const channel = await interaction.guild.channels.create({
      name: ticketName,
      type: ChannelType.GuildText,
      parent: process.env.CATEGORY_TICKETS,
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

    const embed = new EmbedBuilder()
      .setTitle('Ticket Opened')
      .setDescription(`Welcome ${interaction.user}`)
      .setFooter({ text: process.env.FOOTER_TEXT });

    await channel.send({ embeds: [embed] });

    await interaction.reply({
      content: `Ticket created: ${channel}`,
      ephemeral: true
    });
  }
});

client.login(process.env.TOKEN);
