const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const databaseService = require('../services/database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('leaderboard')
        .setDescription('Display the top 10 users on the server leveling leaderboard.'),
    async execute(interaction) {
        await interaction.deferReply();

        const guildId = interaction.guild.id;

        try {
            // Find top 10 players
            const topPlayers = await databaseService.Level.find({ guildId })
                .sort({ level: -1, xp: -1 })
                .limit(10);

            if (topPlayers.length === 0) {
                await interaction.editReply('📊 The leaderboard is currently empty. Start sending messages to rank up!');
                return;
            }

            const leaderboardEmbed = new EmbedBuilder()
                .setTitle(`🏆 ${interaction.guild.name} Level Leaderboard`)
                .setColor('#f1c40f')
                .setThumbnail(interaction.guild.iconURL({ dynamic: true }))
                .setTimestamp();

            const descriptionLines = [];
            
            for (let i = 0; i < topPlayers.length; i++) {
                const data = topPlayers[i];
                let userTag = 'Unknown User';
                try {
                    const user = await interaction.client.users.fetch(data.userId);
                    userTag = user.tag;
                } catch {
                    userTag = `User ID: ${data.userId}`;
                }

                let medal = '';
                if (i === 0) medal = '🥇 ';
                else if (i === 1) medal = '🥈 ';
                else if (i === 2) medal = '🥉 ';
                else medal = `**#${i + 1}** `;

                const xpNeeded = 100 * (data.level + 1);
                descriptionLines.push(`${medal}${userTag} - **Level ${data.level}** (${data.xp}/${xpNeeded} XP)`);
            }

            leaderboardEmbed.setDescription(descriptionLines.join('\n'));

            await interaction.editReply({ embeds: [leaderboardEmbed] });
        } catch (error) {
            console.error('Error fetching leaderboard:', error);
            await interaction.editReply('❌ An error occurred while retrieving the leaderboard.');
        }
    },
};
