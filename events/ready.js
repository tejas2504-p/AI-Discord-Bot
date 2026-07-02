const { Events } = require('discord.js');

module.exports = {
    name: Events.ClientReady,
    once: true,
    execute(client) {
        console.log(`Logged in as ${client.user.tag}!`);
        console.log(`Bot is ready in ${client.guilds.cache.size} guilds.`);
        if (client.io) {
            client.io.emit('bot_status', {
                status: 'online',
                uptime: 0,
                guilds: client.guilds.cache.size,
                ping: client.ws.ping,
                user: client.user ? {
                    tag: client.user.tag,
                    avatar: client.user.displayAvatarURL()
                } : null
            });
        }
    },
};
