const { Events, EmbedBuilder } = require('discord.js');
const databaseService = require('../services/database');

module.exports = {
    name: Events.GuildMemberRemove,
    async execute(member) {
        try {
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
