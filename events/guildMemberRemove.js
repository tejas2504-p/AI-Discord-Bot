const { Events, EmbedBuilder } = require('discord.js');
const databaseService = require('../services/database');

module.exports = {
    name: Events.GuildMemberRemove,
    async execute(member) {
        try {
            if (member.client.broadcastEvent) {
                member.client.broadcastEvent('guildMemberRemove', {
                    guildId: member.guild.id,
                    guildName: member.guild.name,
                    author: member.user.tag,
                    authorId: member.id,
                    content: `Left the server. ID: ${member.id}`
                });
            }

            const guildId = member.guild.id;
            const config = await databaseService.GuildConfig.findOne({ guildId });
            if (!config || !config.logChannelId) return;

            const logChannel = member.guild.channels.cache.get(config.logChannelId);
            if (logChannel) {
                const logEmbed = new EmbedBuilder()
                    .setTitle('📤 Member Left')
                    .setDescription(`**User:** ${member.user.tag} (${member})\n**ID:** ${member.id}`)
                    .setColor('#ff3333')
                    .setTimestamp();
                
                await logChannel.send({ embeds: [logEmbed] });
            }
        } catch (error) {
            console.error('Error in GuildMemberRemove event:', error);
        }
    },
};
