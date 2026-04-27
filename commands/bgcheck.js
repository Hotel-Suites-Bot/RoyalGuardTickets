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
    const username = args[0];

    const loading = new EmbedBuilder()
      .setColor('#2b2d31')
      .setTitle('Background Checking')
      .setDescription('Please hold on while we background check the user.');

    const msg = await message.channel.send({ embeds: [loading] });

    try {
      const userId = await noblox.getIdFromUsername(username);
      const info = await noblox.getPlayerInfo(userId);

      // 🔹 Safe stats
      let friends = [];
      try { friends = await noblox.getFriends(userId); } catch {}

      let badges = [];
      try { badges = await noblox.getPlayerBadges(userId); } catch {}

      // 🔥 NEW: DIRECT GROUP FETCH (NO NOBLOX)
      let groups = [];
      try {
        const res = await axios.get(`https://groups.roblox.com/v1/users/${userId}/groups/roles`);
        groups = res.data.data || [];
      } catch (e) {
        console.error('Group API failed:', e.message);
        groups = [];
      }

      const avatar = `https://www.roblox.com/headshot-thumbnail/image?userId=${userId}&width=420&height=420&format=png`;
      const profile = `https://www.roblox.com/users/${userId}/profile`;

      // 🔹 Flag system
      const flaggedNames = ['British Army', 'BBA', 'LBA'];
      const flaggedSet = new Set();

      const formattedGroups = groups.map(g => {
        const name = g.group.name;

        const isFlagged = flaggedNames.some(flag =>
          name.toLowerCase().includes(flag.toLowerCase())
        );

        if (isFlagged) flaggedSet.add(name);

        return `${isFlagged ? '⚠️' : '•'} ${name} (Role: ${g.role.name})`;
      });

      // 🔹 Pagination
      const chunkSize = 10;
      const groupPages = [];

      for (let i = 0; i < formattedGroups.length; i += chunkSize) {
        groupPages.push(formattedGroups.slice(i, i + chunkSize));
      }

      let page = 0;

      const buildEmbed = () => {
        if (page === 0) {
          return new EmbedBuilder()
            .setColor('#2b2d31')
            .setAuthor({ name: username, iconURL: avatar })
            .setThumbnail(avatar)
            .setDescription('**Roblox Background Check**')
            .addFields(
              { name: 'Username', value: username, inline: true },
              { name: 'Profile', value: `[Open Profile](${profile})`, inline: true },
              { name: 'Created', value: new Date(info.joinDate).toUTCString() },

              { name: 'Friends', value: `${friends.length}`, inline: true },
              { name: 'Badges', value: `${badges.length}`, inline: true },
              { name: 'Groups', value: `${groups.length}`, inline: true },

              {
                name: 'Alerts',
                value: flaggedSet.size > 0
                  ? `⚠️ User is in ${flaggedSet.size} flagged group(s)`
                  : '✅ No flagged groups detected'
              }
            )
            .setFooter({ text: `Page 1/${groupPages.length + 1}` });
        }

        const current = groupPages[page - 1] || [];

        return new EmbedBuilder()
          .setColor('#2b2d31')
          .setTitle(`Groups (Page ${page}/${groupPages.length})`)
          .setDescription(current.join('\n') || 'No groups found.')
          .setFooter({ text: `Page ${page + 1}/${groupPages.length + 1}` });
      };

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('prev').setLabel('⬅️').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('next').setLabel('➡️').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('delete').setLabel('🗑️').setStyle(ButtonStyle.Danger)
      );

      await msg.edit({
        embeds: [buildEmbed()],
        components: [row]
      });

      const collector = msg.createMessageComponentCollector({ time: 120000 });

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
