require('dotenv').config();

const {
  Client,
  GatewayIntentBits,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  EmbedBuilder,
  ChannelType,
  PermissionsBitField
} = require('discord.js');

const mongoose = require('mongoose');
const { createTranscript } = require('discord-html-transcripts');

// ===== DATABASE =====
mongoose.connect(process.env.MONGO_URI);

const ticketSchema = new mongoose.Schema({
  userId: String,
  channelId: String,
  type: String,
  number: Number
});

const counterSchema = new mongoose.Schema({
  type: String,
  count: Number
});

const Ticket = mongoose.model('Ticket', ticketSchema);
const Counter = mongoose.model('Counter', counterSchema);

// ===== CLIENT =====
const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

const pendingTickets = new Map();

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
});


// ================= PANEL =================
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

    await interaction.reply({
      content: 'Open a ticket:',
      components: [new ActionRowBuilder().addComponents(menu)]
    });
  }
});


// ================= SELECT → MODAL =================
client.on('interactionCreate', async interaction => {
  if (!interaction.isStringSelectMenu()) return;
  if (interaction.customId !== 'ticket_select') return;

  const type = interaction.values[0];
  pendingTickets.set(interaction.user.id, type);

  const modal = new ModalBuilder()
    .setCustomId('ticket_modal')
    .setTitle('Support Questions');

  let questions = [];

  if (type === 'ingame') {
    questions = [
      'What is your Roblox username?',
      'Main Game or Parade Grounds?',
      'What is the inquiry or assistance you need?'
    ];
  }

  if (type === 'dmi') {
    questions = [
      'Their Roblox Username And Rank / Regiment If Any',
      'Your Username and Rank',
      'Full in-depth detail of the incident.',
      'Any evidence or proof to back up your story if so send in ticket.'
    ];
  }

  if (type === 'dev') {
    questions = [
      'Your Roblox Username and Rank / Regiment If Any?',
      'Main Game or Parade Grounds?',
      'What is the issue?',
      'Any evidence?'
    ];
  }

  const rows = questions.map((q, i) =>
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId(`q${i}`)
        .setLabel(q)
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
    )
  );

  modal.addComponents(rows);
  await interaction.showModal(modal);
});


// ================= MODAL SUBMIT → CREATE =================
client.on('interactionCreate', async interaction => {
  if (!interaction.isModalSubmit()) return;
  if (interaction.customId !== 'ticket_modal') return;

  const type = pendingTickets.get(interaction.user.id);

  if (!type) {
    return interaction.reply({ content: '❌ Error.', ephemeral: true });
  }

  // ONE TICKET CHECK
  const existing = await Ticket.findOne({ userId: interaction.user.id });
  if (existing) {
    return interaction.reply({
      content: '❌ You already have an open ticket.',
      ephemeral: true
    });
  }

  // COUNTER SYSTEM
  let counter = await Counter.findOne({ type });
  if (!counter) counter = await Counter.create({ type, count: 0 });

  counter.count++;
  await counter.save();

  const ticketName = `${type}-${counter.count}`;

  let roleId;
  if (type === 'ingame') roleId = process.env.ROLE_SUPPORT;
  if (type === 'dmi') roleId = process.env.ROLE_DMI;
  if (type === 'dev') roleId = process.env.ROLE_DEV;

  const channel = await interaction.guild.channels.create({
    name: ticketName,
    type: ChannelType.GuildText,
    parent: process.env.CATEGORY_TICKETS,
    permissionOverwrites: [
      { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
      { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel] },
      { id: roleId, allow: [PermissionsBitField.Flags.ViewChannel] }
    ]
  });

  await Ticket.create({
    userId: interaction.user.id,
    channelId: channel.id,
    type,
    number: counter.count
  });

  // FORMAT ANSWERS CLEANLY
  const answers = interaction.fields.fields.map((f, i) =>
    `**${i + 1}.** ${f.value}`
  ).join('\n\n');

  const embed = new EmbedBuilder()
    .setColor(0x2b2d31)
    .setTitle('Support Ticket')
    .setDescription(
      `Hey ${interaction.user},\n\n` +
      `Thank you for contacting **Grenadier Guard Support**.\n\n` +
      `${answers}\n\n` +
      `Please wait patiently for a response.`
    )
    .setFooter({ text: process.env.FOOTER_TEXT });

  const buttons = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('claim').setLabel('Claim').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('escalate').setLabel('Escalate').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('close').setLabel('Close').setStyle(ButtonStyle.Danger)
  );

  await channel.send({
    content: `${interaction.user} <@&${roleId}>`,
    embeds: [embed],
    components: [buttons]
  });

  pendingTickets.delete(interaction.user.id);

  await interaction.reply({
    content: `✅ Ticket created: ${channel}`,
    ephemeral: true
  });
});


// ================= BUTTONS =================
client.on('interactionCreate', async interaction => {
  if (!interaction.isButton()) return;

  const member = interaction.member;

  const allowed = interaction.channel.permissionOverwrites.cache.some(over =>
    member.roles.cache.has(over.id)
  );

  if (!allowed) {
    return interaction.reply({ content: '❌ Not allowed.', ephemeral: true });
  }

  if (interaction.customId === 'claim') {
    return interaction.reply(`🪖 ${interaction.user} claimed this ticket.`);
  }

  if (interaction.customId === 'escalate') {
    const menu = new StringSelectMenuBuilder()
      .setCustomId('escalate_select')
      .addOptions([
        { label: 'DMI', value: process.env.ROLE_DMI },
        { label: 'Developer', value: process.env.ROLE_DEV }
      ]);

    return interaction.reply({
      content: 'Select role to escalate:',
      components: [new ActionRowBuilder().addComponents(menu)],
      ephemeral: true
    });
  }

  if (interaction.customId === 'close') {

    await interaction.reply('Saving transcript...');

    const transcript = await createTranscript(interaction.channel);

    const log = interaction.guild.channels.cache.get(process.env.LOG_CHANNEL);
    if (log) log.send({ files: [transcript] });

    await Ticket.deleteOne({ channelId: interaction.channel.id });

    setTimeout(() => interaction.channel.delete(), 3000);
  }
});


// ================= ESCALATE SELECT =================
client.on('interactionCreate', async interaction => {
  if (!interaction.isStringSelectMenu()) return;
  if (interaction.customId !== 'escalate_select') return;

  const roleId = interaction.values[0];

  await interaction.channel.permissionOverwrites.edit(roleId, {
    ViewChannel: true
  });

  await interaction.update({
    content: '🔺 Escalated.',
    components: []
  });
});

client.login(process.env.TOKEN);
