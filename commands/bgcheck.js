const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');

const noblox = require('noblox.js');
const axios = require('axios');

module.exports = {
  name: 'bgcheck',

  async execute(message, args) {
    if (!args[0]) return message.reply('Provide a Roblox username.');
    const username = args[0].toLowerCase();

    const loading = new EmbedBuilder()
      .setColor('#1e1f22')
      .setTitle('Background Checking')
      .setDescription('Gathering intelligence...');

    const msg = await message.channel.send({ embeds: [loading] });

    try {
      // 🔹 Roblox
      const userId = await noblox.getIdFromUsername(username);
      const info = await noblox.getPlayerInfo(userId);

      const avatar = `https://www.roblox.com/headshot-thumbnail/image?userId=${userId}&width=420&height=420&format=png`;
      const profile = `https://www.roblox.com/users/${userId}/profile`;

      // 🔹 Friends count (stable)
      let friendsCount = 0;
      try {
        const res = await axios.get(`https://friends.roblox.com/v1/users/${userId}/friends/count`);
        friendsCount = res.data.count || 0;
      } catch {}

      // 🔹 Badges
      let badges = [];
      try { badges = await noblox.getPlayerBadges(userId); } catch {}

      // 🔹 Groups (API)
      let groups = [];
      try {
        const res = await axios.get(`https://groups.roblox.com/v1/users/${userId}/groups/roles`);
        groups = res.data.data || [];
      } catch {}

      // 🔹 Flag detection
      const flaggedNames = ['British Army', 'BBA', 'LBA'];
      const flaggedSet = new Set();

      const formattedGroups = groups.map(g => {
        const name = g.group.name;
        const flagged = flaggedNames.some(f =>
          name.toLowerCase().includes(f.toLowerCase())
        );
        if (flagged) flaggedSet.add(name);

        return `${flagged ? '⚠️' : '•'} ${name} — ${g.role.name}`;
      });

      // 🔹 Discord match
      await message.guild.members.fetch();

      const member = message.guild.members.cache.find(m => {
        const nick = m.nickname?.toLowerCase() || '';
        const user = m.user.username.toLowerCase();

        return nick.includes(username) || user.includes(username);
      });

      const discordInfo = member
        ? `User: ${member.user.tag}\nJoined: ${new Date(member.joinedAt).toUTCString()}`
        : 'No linked Discord user found';

      // 🔹 Pagination
      const chunkSize = 10;
      const groupPages = [];

      for (let i = 0; i < formattedGroups.length; i += chunkSize) {
        groupPages.push(formattedGroups.slice(i, i + chunkSize));
      }

      let page = 0;

      // 🔹 Embed builder (MATCHES YOUR STYLE)
      const buildEmbed = () => {

        // MAIN PAGE
        if (page === 0) {
          return new EmbedBuilder()
            .setColor('#1e1f22')
            .setAuthor({ name: info.username })
            .setThumbnail(avatar)
            .setDescription(
              `**USER INTELLIGENCE REPORT**\n` +
              `━━━━━━━━━━━━━━━━━━\n\n` +

              `**DISCORD RECORD**\n` +
              `━━━━━━━━━━━━━━━━━━\n` +
              `${discordInfo}\n\n` +

              `**ROBLOX ACCOUNT**\n` +
              `━━━━━━━━━━━━━━━━━━\n` +
              `Profile: ${profile}\n` +
              `Created: ${new Date(info.joinDate).toUTCString()}\n\n` +

              `**ACCOUNT STATISTICS**\n` +
              `━━━━━━━━━━━━━━━━━━\n` +
              `Friends: ${friendsCount}\n` +
              `Badges: ${badges.length}\n` +
              `Groups: ${groups.length}\n\n` +

              `**ALERT STATUS**\n` +
              `━━━━━━━━━━━━━━━━━━\n` +
              (
                flaggedSet.size > 0
                  ? `⚠️ Flagged Groups Detected (${flaggedSet.size})`
                  : `✅ No Threats Detected`
              )
            )
            .setFooter({ text: `Page 1/${groupPages.length + 1}` });
        }

        // GROUP PAGES
        const current = groupPages[page - 1] || [];

        return new EmbedBuilder()
          .setColor('#1e1f22')
          .setTitle('GROUP INTELLIGENCE')
          .setDescription(
            `━━━━━━━━━━━━━━━━━━\n` +
            (current.join('\n') || 'No groups found.')
          )
          .setFooter({ text: `Page ${page + 1}/${groupPages.length + 1}` });
      };

      // 🔹 Buttons
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('prev')
          .setLabel('⬅')
          .setStyle(ButtonStyle.Secondary),

        new ButtonBuilder()
          .setCustomId('next')
          .setLabel('➡')
          .setStyle(ButtonStyle.Secondary),

        new ButtonBuilder()
          .setCustomId('delete')
          .setLabel('✖')
          .setStyle(ButtonStyle.Danger)
      );

      await msg.edit({
        embeds: [buildEmbed()],
        components: [row]
      });

      const collector = msg.createMessageComponentCollector({
        time: 120000
      });

      collector.on('collect', async i => {
        if (i.user.id !== message.author.id)
          return i.reply({ content: 'Not your session.', ephemeral: true });

        if (i.customId === 'next') page = page >= groupPages.length ? 0 : page + 1;
        if (i.customId === 'prev') page = page <= 0 ? groupPages.length : page - 1;

        if (i.customId === 'delete') {
          collector.stop();
          return msg.delete().catch(() => {});
        }

        await i.update({
          embeds: [buildEmbed()],
          components: [row]
        });
      });

      collector.on('end', () => {
        msg.edit({ components: [] }).catch(() => {});
      });

    } catch (err) {
      console.error(err);
      msg.edit({
        content: '❌ Failed to fetch Roblox data.',
        embeds: []
      });
    }
  }
};
