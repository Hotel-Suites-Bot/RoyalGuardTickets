const { EmbedBuilder } = require('discord.js');
const noblox = require('noblox.js');
const axios = require('axios');

module.exports = {
  name: 'bgcheck',

  async execute(message, args) {
    if (!args[0]) return message.reply('Provide a Roblox username.');
    const username = args[0].toLowerCase();

    const loading = new EmbedBuilder()
      .setColor('#1e1f22')
      .setTitle('🔎 Background Checking')
      .setDescription('Scanning Roblox & Discord records...');

    const msg = await message.channel.send({ embeds: [loading] });

    try {
      // 🔹 Roblox data
      const userId = await noblox.getIdFromUsername(username);
      const info = await noblox.getPlayerInfo(userId);

      const avatar = `https://www.roblox.com/headshot-thumbnail/image?userId=${userId}&width=420&height=420&format=png`;
      const profile = `https://www.roblox.com/users/${userId}/profile`;

      // 🔹 Friends (fixed)
      let friendsCount = 0;
      try {
        const res = await axios.get(`https://friends.roblox.com/v1/users/${userId}/friends/count`);
        friendsCount = res.data.count || 0;
      } catch {}

      // 🔹 Badges
      let badges = [];
      try { badges = await noblox.getPlayerBadges(userId); } catch {}

      // 🔹 Groups (stable API)
      let groups = [];
      try {
        const res = await axios.get(`https://groups.roblox.com/v1/users/${userId}/groups/roles`);
        groups = res.data.data || [];
      } catch {}

      // 🔹 FLAG SYSTEM
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

      // 🔹 DISCORD MATCHING SYSTEM
      await message.guild.members.fetch(); // cache all members

      const member = message.guild.members.cache.find(m => {
        const nick = m.nickname ? m.nickname.toLowerCase() : '';
        const user = m.user.username.toLowerCase();

        return (
          nick.includes(username) ||
          user.includes(username)
        );
      });

      let discordMatch = '❌ No matching Discord user found';
      if (member) {
        discordMatch = `✅ ${member.user.tag}`;
      }

      // 🔹 PAGINATION
      const chunkSize = 10;
      const groupPages = [];

      for (let i = 0; i < formattedGroups.length; i += chunkSize) {
        groupPages.push(formattedGroups.slice(i, i + chunkSize));
      }

      let page = 0;

      const buildEmbed = () => {

        if (page === 0) {
          return new EmbedBuilder()
            .setColor('#1e1f22')
            .setAuthor({ name: info.username })
            .setThumbnail(avatar)
            .setDescription(
              `**BACKGROUND CHECK REPORT**\n` +
              `━━━━━━━━━━━━━━━━━━\n` +
              `**Profile:** [View Profile](${profile})\n` +
              `**Created:** ${new Date(info.joinDate).toUTCString()}\n\n` +

              `**DISCORD MATCH**\n` +
              `━━━━━━━━━━━━━━━━━━\n` +
              `${discordMatch}\n\n` +

              `**STATISTICS**\n` +
              `━━━━━━━━━━━━━━━━━━\n` +
              `• Friends: ${friendsCount}\n` +
              `• Badges: ${badges.length}\n` +
              `• Groups: ${groups.length}\n\n` +

              `**ALERT STATUS**\n` +
              `━━━━━━━━━━━━━━━━━━\n` +
              (
                flaggedSet.size > 0
                  ? `⚠️ Detected in ${flaggedSet.size} flagged group(s)`
                  : `✅ No threats detected`
              )
            )
            .setFooter({ text: `Page 1/${groupPages.length + 1}` });
        }

        const current = groupPages[page - 1] || [];

        return new EmbedBuilder()
          .setColor('#1e1f22')
          .setTitle('📁 GROUP AFFILIATIONS')
          .setDescription(
            `━━━━━━━━━━━━━━━━━━\n` +
            (current.join('\n') || 'No groups found.')
          )
          .setFooter({ text: `Page ${page + 1}/${groupPages.length + 1}` });
      };

      await msg.edit({ embeds: [buildEmbed()] });

      // 🔹 Reactions
      await msg.react('⬅️');
      await msg.react('➡️');
      await msg.react('🗑️');

      const collector = msg.createReactionCollector({ time: 120000 });

      collector.on('collect', async (reaction, user) => {
        if (user.id !== message.author.id) return;

        if (reaction.emoji.name === '➡️') {
          page = page >= groupPages.length ? 0 : page + 1;
        }

        if (reaction.emoji.name === '⬅️') {
          page = page <= 0 ? groupPages.length : page - 1;
        }

        if (reaction.emoji.name === '🗑️') {
          collector.stop();
          return msg.delete().catch(() => {});
        }

        await msg.edit({ embeds: [buildEmbed()] });
        await reaction.users.remove(user.id);
      });

      collector.on('end', () => {
        msg.reactions.removeAll().catch(() => {});
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
