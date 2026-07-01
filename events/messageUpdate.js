const { Events, EmbedBuilder } = require('discord.js');
const databaseService = require('../services/database');

module.exports = {
    name: Events.MessageUpdate,
    async execute(oldMessage, newMessage) {
        // Ignore bot messages, direct messages, and cases where content is identical (e.g. embeds loading)
        if (!newMessage.guild || (newMessage.author && newMessage.author.bot)) return;
        if (oldMessage.content === newMessage.content) return;

        try {
            const guildId = newMessage.guild.id;
            const config = await databaseService.GuildConfig.findOne({ guildId });
            if (!config || !config.logChannelId) return;

            const logChannel = newMessage.guild.channels.cache.get(config.logChannelId);
            if (logChannel) {
                const before = oldMessage.content ? (oldMessage.content.length > 1024 ? oldMessage.content.slice(0, 1010) + '...' : oldMessage.content) : '*(Empty)*';
                const after = newMessage.content ? (newMessage.content.length > 1024 ? newMessage.content.slice(0, 1010) + '...' : newMessage.content) : '*(Empty)*';

                const logEmbed = new EmbedBuilder()
                    .setTitle('✏️ Message Edited')
                    .setDescription(`**Author:** ${newMessage.author.tag} (${newMessage.author})\n**Channel:** ${newMessage.channel}\n**Jump to message:** [Click Here](${newMessage.url})`)
                    .addFields(
                        { name: 'Original Content', value: before },
                        { name: 'Updated Content', value: after }
                    )
                    .setColor('#ffff00')
                    .setTimestamp();

                await logChannel.send({ embeds: [logEmbed] });
            }
        } catch (error) {
            console.error('Error in MessageUpdate event:', error);
        }
    },
};
