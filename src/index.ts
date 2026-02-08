import {
  Client,
  GatewayIntentBits,
  Message,
  EmbedBuilder,
  TextChannel,
  PartialMessage
} from 'discord.js';
import 'dotenv/config';
import http from 'http';

// --- KEEP-ALIVE WEB SERVER ---
// This allows free hosts to "ping" the bot so it stays online 24/7.
http.createServer((req, res) => {
  res.write("Runners Org Bot is Online");
  res.end();
}).listen(8080); 

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const rankOrder = ['Entrance Runner', 'Basic Runner', 'Skilled Runner', 'Master Runner', 'Diligent Runner', 'Lead Runner', 'Archivist Runner'];

const HEAD_RUNNER_ID = '1447712026775392357';
const EXECUTIVE_RUNNER_ID = '1467220717056823369';
const ARCHIVIST_RUNNER_ID = '1465730843090616448';

const PROMO_LOG_CHANNEL_ID = '1462640325712547997';
const LOG_CHANNEL_ID = '1469817201904058430'; 

client.on('ready', (c) => {
  console.log(`${c.user.tag} is operational and web server is live.`);
});

// Logging: Message Delete
client.on('messageDelete', async (message: Message | PartialMessage) => {
  if (message.author?.bot || !message.guild) return;
  const logChannel = client.channels.cache.get(LOG_CHANNEL_ID) as TextChannel;
  if (!logChannel) return;

  const deleteEmbed = new EmbedBuilder()
    .setAuthor({ 
        name: 'Message Deleted', 
        iconURL: message.author?.displayAvatarURL() || undefined 
    })
    .setColor(0x2b2d31)
    .addFields(
      { name: 'User', value: `${message.author} (${message.author?.id || 'Unknown ID'})`, inline: true },
      { name: 'Channel', value: `${message.channel}`, inline: true },
      { name: 'Content', value: message.content || "No text content" }
    )
    .setTimestamp();
  
  try { await logChannel.send({ embeds: [deleteEmbed] }); } catch (e) { console.error("Logging error (Delete):", e); }
});

// Logging: Message Edit
client.on('messageUpdate', async (oldMsg, newMsg) => {
  if (oldMsg.author?.bot || oldMsg.content === newMsg.content || !oldMsg.guild) return;
  const logChannel = client.channels.cache.get(LOG_CHANNEL_ID) as TextChannel;
  if (!logChannel) return;

  const editEmbed = new EmbedBuilder()
    .setAuthor({ 
        name: 'Message Edited', 
        iconURL: oldMsg.author?.displayAvatarURL() || undefined 
    })
    .setColor(0x2b2d31)
    .addFields(
      { name: 'User', value: `${oldMsg.author}`, inline: true },
      { name: 'Channel', value: `${oldMsg.channel}`, inline: true },
      { name: 'Original', value: oldMsg.content || "Empty" },
      { name: 'Revised', value: newMsg.content || "Empty" }
    )
    .setTimestamp();

  try { await logChannel.send({ embeds: [editEmbed] }); } catch (e) { console.error("Logging error (Update):", e); }
});

client.on('messageCreate', async (message: Message) => {
  if (!message.guild || message.author.bot || !message.content.startsWith('!')) return;

  const args = message.content.slice(1).trim().split(/ +/);
  const command = args.shift()?.toLowerCase();

  const isStaff = message.member?.roles.cache.has(HEAD_RUNNER_ID) ||
    message.member?.roles.cache.has(EXECUTIVE_RUNNER_ID) ||
    message.member?.roles.cache.has(ARCHIVIST_RUNNER_ID) ||
    message.member?.id === message.guild.ownerId;

  if (!isStaff) return;

  // We cast the channel as a TextChannel to prevent TypeScript "send" errors
  const textChannel = message.channel as TextChannel;

  // SAY COMMAND
  if (command === 'say') {
    const text = args.join(' ');
    if (!text) return;
    try { await message.delete(); } catch (e) { }
    return textChannel.send(text);
  }

  // BOTINFO COMMAND
  if (command === 'botinfo') {
    const uptime = client.uptime || 0;
    const days = Math.floor(uptime / 86400000);
    const hours = Math.floor(uptime / 3600000) % 24;
    const minutes = Math.floor(uptime / 60000) % 60;
    const seconds = Math.floor(uptime / 1000) % 60;
    const memory = process.memoryUsage().heapUsed / 1024 / 1024;

    const infoEmbed = new EmbedBuilder()
      .setTitle('System Diagnostics')
      .setColor(0x2b2d31)
      .addFields(
        { name: 'Latency', value: `${client.ws.ping}ms`, inline: true },
        { name: 'Uptime', value: `${days}d ${hours}h ${minutes}m ${seconds}s`, inline: true },
        { name: 'Memory', value: `${memory.toFixed(2)} MB`, inline: true },
        { name: 'Servers', value: `${client.guilds.cache.size}`, inline: true }
      )
      .setFooter({ text: 'Runners Org Core System' })
      .setTimestamp();

    return textChannel.send({ embeds: [infoEmbed] });
  }

  if (command === 'slow') {
    const seconds = parseInt(args[0]);
    if (isNaN(seconds)) return message.reply('Usage: !slow <seconds>');
    try {
      await textChannel.setRateLimitPerUser(seconds);
      return message.reply(`Slowmode set to ${seconds}s.`);
    } catch (err) { return message.reply('Missing permissions.'); }
  }

  if (command === 'commands') {
    const helpEmbed = new EmbedBuilder()
      .setTitle('Runners Org Management')
      .setColor(0x2b2d31)
      .addFields(
        { name: '!promote <@user>', value: 'Rank advancement.' },
        { name: '!demote <@user>', value: 'Rank reversion.' },
        { name: '!say <text>', value: 'Bot speaks & deletes command.' },
        { name: '!botinfo', value: 'Check bot diagnostics.' },
        { name: '!slow <seconds>', value: 'Update slowmode.' }
      );
    return message.reply({ embeds: [helpEmbed] });
  }

  if (command === 'promote' || command === 'demote') {
    let target = message.mentions.members?.first() || (args[0] ? await message.guild.members.fetch(args[0]).catch(() => null) : null);
    if (!target) return message.reply("User not found.");

    const currentRole = target.roles.cache.find((r) => rankOrder.includes(r.name));
    const oldRoleName = currentRole ? currentRole.name : "None";
    const currentIndex = currentRole ? rankOrder.indexOf(currentRole.name) : -1;
    let nextIndex = command === 'promote' ? currentIndex + 1 : currentIndex - 1;

    try {
      if (currentRole) await target.roles.remove(currentRole);
      if (nextIndex >= 0 && nextIndex < rankOrder.length) {
        const nextRoleName = rankOrder[nextIndex];
        const nextRole = message.guild.roles.cache.find(r => r.name === nextRoleName);
        if (nextRole) {
          await target.roles.add(nextRole);
          message.reply(`${target.user.username} updated to ${nextRoleName}.`);
          if (command === 'promote') {
            const promoChannel = client.channels.cache.get(PROMO_LOG_CHANNEL_ID) as TextChannel;
            if (promoChannel) {
              const promoEmbed = new EmbedBuilder()
                .setTitle('Rank Promotion')
                .setColor(0x2b2d31)
                .setDescription(`${target.user.username} moved from ${oldRoleName} to ${nextRoleName}`)
                .setFooter({ text: `Authorized by ${message.author.username}` })
                .setTimestamp();
              await promoChannel.send({ embeds: [promoEmbed] });
            }
          }
        }
      } else {
        return message.reply(nextIndex < 0 ? "Ranks cleared." : "Maximum rank reached.");
      }
    } catch (err) { return message.reply("Failed to update roles."); }
  }
});

process.on('unhandledRejection', error => console.error('Unhandled Rejection:', error));
client.login(process.env.DISCORD_TOKEN);
