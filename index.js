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

// ===== MONGO =====
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

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

// ===== PANEL =====
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'panel') {

    const menu = new StringSelectMenuBuilder()
      .setCustomId('ticket_select')
      .setPlaceholder('Select Ticket Type')
      .addOptions([
        { label: 'Ingame Support', value: 'ingame' },
        { label: 'DMI Request', value: 'dmi' },
        { label: 'Developer Support', value: 'dev' }
      ]);

    await interaction.reply({
      content: 'Open a ticket:',
      components: [new ActionRowBuilder().addComponents(menu)]
    });
  }
});

// ===== CREATE TICKET =====
client.on('interactionCreate', async interaction => {
  if (!interaction.isStringSelectMenu()) return;
  if (interaction.customId !== 'ticket_select') return;

  const type = interaction.values[0];

  // ONE TICKET CHECK
  const existing = await Ticket.findOne({ userId: interaction.user.id });
  if (existing) {
    return interaction.reply({
      content: '❌ You already have an open ticket.',
      ephemeral: true
    });
  }

  // COUNTER
  let counter = await Counter.findOne({ type });
  if (!counter) counter = await Counter.create({ type, count: 0 });

  counter.count++;
  await counter.save();

  const name = `${type}-${counter.count}`;

  let roleId;
  if (type === 'ingame') roleId = process.env.ROLE_SUPPORT;
  if (type === 'dmi') roleId = process.env.ROLE_DMI;
  if (type === 'dev') roleId = process.env.ROLE_DEV;

  const channel = await interaction.guild.channels.create({
    name,
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

  // EMBED
  const embed = new EmbedBuilder()
    .setColor(0x2b2d31)
    .setDescription(
      `Hey ${interaction.user},\n\n` +
      `Welcome to **Grenadier Guard Support**.\nPlease answer the questions below.\n\n` +
      `Please wait patiently for a response.`
    )
    .setFooter({ text: process.env.FOOTER_TEXT });

  const buttons = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('claim').setLabel('Claim').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('escalate').setLabel('Escalate').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('close').setLabel('Close').setStyle(ButtonStyle.Danger)
  );

  await channel.send({ embeds: [embed], components: [buttons] });

  // MODAL
  const modal = new ModalBuilder()
    .setCustomId(`modal_${type}`)
    .setTitle('Ticket Questions');

  const input1 = new TextInputBuilder()
    .setCustomId('q1')
    .setLabel('Explain your issue')
    .setStyle(TextInputStyle.Paragraph);

  modal.addComponents(new ActionRowBuilder().addComponents(input1));

  await interaction.showModal(modal);
});

// ===== MODAL =====
client.on('interactionCreate', async interaction => {
  if (!interaction.isModalSubmit()) return;

  const embed = new EmbedBuilder()
    .setTitle('Responses')
    .setDescription(interaction.fields.getTextInputValue('q1'))
    .setFooter({ text: process.env.FOOTER_TEXT });

  await interaction.reply({ content: 'Submitted!', ephemeral: true });
  await interaction.channel.send({ embeds: [embed] });
});

// ===== BUTTONS =====
client.on('interactionCreate', async interaction => {
  if (!interaction.isButton()) return;

  const member = interaction.member;

  // CHECK ROLE ACCESS
  const allowed = interaction.channel.permissionOverwrites.cache.some(over =>
    member.roles.cache.has(over.id)
  );

  if (!allowed) {
    return interaction.reply({ content: '❌ Not allowed.', ephemeral: true });
  }

  // CLAIM
  if (interaction.customId === 'claim') {
    return interaction.reply(`🪖 ${interaction.user} claimed this ticket.`);
  }

  // ESCALATE
  if (interaction.customId === 'escalate') {
    const menu = new StringSelectMenuBuilder()
      .setCustomId('escalate_select')
      .addOptions([
        { label: 'DMI', value: process.env.ROLE_DMI },
        { label: 'Developer', value: process.env.ROLE_DEV }
      ]);

    return interaction.reply({
      content: 'Select role:',
      components: [new ActionRowBuilder().addComponents(menu)],
      ephemeral: true
    });
  }

  // CLOSE
  if (interaction.customId === 'close') {

    await interaction.reply('Saving transcript...');

    const transcript = await createTranscript(interaction.channel);

    const log = interaction.guild.channels.cache.get(process.env.LOG_CHANNEL);
    if (log) log.send({ files: [transcript] });

    await Ticket.deleteOne({ channelId: interaction.channel.id });

    setTimeout(() => interaction.channel.delete(), 3000);
  }
});

// ===== ESCALATE SELECT =====
client.on('interactionCreate', async interaction => {
  if (!interaction.isStringSelectMenu()) return;
  if (interaction.customId !== 'escalate_select') return;

  const roleId = interaction.values[0];

  await interaction.channel.permissionOverwrites.edit(roleId, {
    ViewChannel: true
  });

  await interaction.update({ content: 'Escalated.', components: [] });
});

client.login(process.env.TOKEN);
