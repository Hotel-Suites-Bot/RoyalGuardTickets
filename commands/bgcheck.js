const { EmbedBuilder } = require('discord.js');
const noblox = require('noblox.js');
const axios = require('axios');

module.exports = {
  name: 'bgcheck',

  async execute(message, args) {
    if (!args[0]) return message.reply('Provide a Roblox username.');
    const username = args[0];

    const loading = new EmbedBuilder()
      .setColor('#1e1f22')
      .setTitle('🔎 Background Checking')
      .setDescription('Please wait while we gather intelligence...');

    const msg = await message.channel.send({ embeds: [loading] });

    try {
      const userId = await noblox.getIdFromUsername(username);
      const info = await noblox.getPlayerInfo(userId);

      let friends = [];
      try { friends = await noblox.getFriends(userId); } catch {}

      let badges = [];
      try { badges = await noblox.getPlayerBadges(userId); } catch {}

      // 🔥 Direct API groups (stable)
      let groups = [];
      try {
        const res = await axios.get(`https://groups.roblox.com/v1/users/${userId}/groups/roles`);
        groups = res.data.data || [];
      } catch {}

      const avatar = `https://www.roblox.com/headshot-thumbnail/image?userId=${userId}&width=420&height=420&format=png`;
      const profile = `https://www.roblox.com/users/${userId}/profile`;

      // 🔹 Flag system
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

      // 🔹 Split groups into pages
      const chunkSize = 10;
      const groupPages = [];

      for (let i = 0; i < formattedGroups.length; i += chunkSize) {
        groupPages.push(formattedGroups.slice(i, i + chunkSize));
      }

      let page = 0;

      // 🔹 Embed builder (PROFESSIONAL STYLE)
      const buildEmbed = () => {

        if (page === 0) {
          return new EmbedBuilder()
            .setColor('#1e1f22')
            .setAuthor({ name: username, iconURL: avatar })
            .setThumbnail(avatar)
            .setDescription(
              `**BACKGROUND CHECK REPORT**\n` +
              `━━━━━━━━━━━━━━━━━━\n` +
              `**Profile:** [View Profile](${profile})\n` +
              `**Created:** ${new Date(info.joinDate).toUTCString()}\n\n` +

              `**STATISTICS**\n` +
              `━━━━━━━━━━━━━━━━━━\n` +
              `• Friends: ${friends.length}\n` +
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
          .setTitle(`📁 GROUP AFFILIATIONS`)
          .setDescription(
            `━━━━━━━━━━━━━━━━━━\n` +
            (current.join('\n') || 'No groups found.')
          )
          .setFooter({ text: `Page ${page + 1}/${groupPages.length + 1}` });
      };

      // 🔹 Send final embed
      await msg.edit({ embeds: [buildEmbed()] });

      // 🔹 Add reactions
      await msg.react('⬅️');
      await msg.react('➡️');
      await msg.react('🗑️');

      // 🔹 Reaction collector
      const collector = msg.createReactionCollector({
        time: 120000
      });

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

        // remove user reaction (keeps it clean)
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
