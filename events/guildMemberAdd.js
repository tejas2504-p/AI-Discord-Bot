const { Events, EmbedBuilder } = require('discord.js');
const databaseService = require('../services/database');

module.exports = {
    name: Events.GuildMemberAdd,
    async execute(member) {
        try {
            const guildId = member.guild.id;
            const config = await databaseService.GuildConfig.findOne({ guildId });
            if (!config) return;

            // Welcome Message
            if (config.welcomeChannelId) {
                const welcomeChannel = member.guild.channels.cache.get(config.welcomeChannelId);
                if (welcomeChannel) {
                    const welcomeEmbed = new EmbedBuilder()
                        .setTitle(`👋 Welcome to ${member.guild.name}!`)
                        .setDescription(`Hey ${member}, welcome to the server! We are thrilled to have you here. Make sure to check the rules and have a great time!`)
                        .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
                        .setColor('#00ff99')
                        .setTimestamp();
                    
                    await welcomeChannel.send({ embeds: [welcomeEmbed] });
                }
            }

            // Member Join Audit Log
            if (config.logChannelId) {
                const logChannel = member.guild.channels.cache.get(config.logChannelId);
                if (logChannel) {
                    const logEmbed = new EmbedBuilder()
                        .setTitle('📥 Member Joined')
                        .setDescription(`**User:** ${member.user.tag} (${member})\n**ID:** ${member.id}\n**Account Created:** <t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`)
                        .setColor('#00ff00')
                        .setTimestamp();
                    
                    await logChannel.send({ embeds: [logEmbed] });
                }
            }
        } catch (error) {
            console.error('Error in GuildMemberAdd event:', error);
        }
    },
};
