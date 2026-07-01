const { Events, EmbedBuilder } = require('discord.js');
const databaseService = require('../services/database');

module.exports = {
    name: Events.MessageDelete,
    async execute(message) {
        // Ignore bot messages and direct messages
        if (!message.guild || (message.author && message.author.bot)) return;

        try {
            const guildId = message.guild.id;
            const config = await databaseService.GuildConfig.findOne({ guildId });
            if (!config || !config.logChannelId) return;

            const logChannel = message.guild.channels.cache.get(config.logChannelId);
            if (logChannel) {
                const logEmbed = new EmbedBuilder()
                    .setTitle('🗑️ Message Deleted')
                    .setDescription(`**Author:** ${message.author?.tag || 'Unknown'} (${message.author || 'Unknown'})\n**Channel:** ${message.channel}\n**Created At:** <t:${Math.floor(message.createdTimestamp / 1000)}:R>`)
                    .addFields(
                        { name: 'Deleted Content', value: message.content ? (message.content.length > 1024 ? message.content.slice(0, 1010) + '...' : message.content) : '*(No text content - possibly embed, sticker, or attachment)*' }
                    )
                    .setColor('#ffa500')
                    .setTimestamp();

                await logChannel.send({ embeds: [logEmbed] });
            }
        } catch (error) {
            console.error('Error in MessageDelete event:', error);
        }
    },
};
