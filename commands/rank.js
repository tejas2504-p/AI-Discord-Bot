const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const databaseService = require('../services/database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('rank')
        .setDescription('Display your or another member\'s leveling rank and XP.')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The member to check rank for')
                .setRequired(false)),
    async execute(interaction) {
        const user = interaction.options.getUser('user') || interaction.user;
        
        // Disallow bots
        if (user.bot) {
            await interaction.reply({ content: '❌ Bots do not acquire levels.', ephemeral: true });
            return;
        }

        await interaction.deferReply();

        const guildId = interaction.guild.id;
        const userId = user.id;

        try {
            const levelData = await databaseService.Level.findOne({ guildId, userId });

            if (!levelData) {
                await interaction.editReply(user.id === interaction.user.id 
                    ? '📊 You do not have any XP yet! Send messages in server channels to start leveling up.'
                    : `📊 **${user.tag}** does not have any XP yet.`);
                return;
            }

            // Calculate Rank Position
            const higherCount = await databaseService.Level.countDocuments({
                guildId,
                $or: [
                    { level: { $gt: levelData.level } },
                    { level: levelData.level, xp: { $gt: levelData.xp } }
                ]
            });
            const rank = higherCount + 1;

            const xpNeeded = 100 * (levelData.level + 1);
            const percent = Math.min(Math.floor((levelData.xp / xpNeeded) * 100), 100);
            
            // Build visual progress bar
            const barLength = 10;
            const progress = Math.round((percent / 100) * barLength);
            const emptyProgress = barLength - progress;
            const progressBar = '█'.repeat(progress) + '░'.repeat(emptyProgress);

            const rankEmbed = new EmbedBuilder()
                .setTitle(`📊 Rank Card - ${user.username}`)
                .setThumbnail(user.displayAvatarURL({ dynamic: true }))
                .setColor('#0099ff')
                .addFields(
                    { name: 'Rank', value: `#${rank}`, inline: true },
                    { name: 'Level', value: `${levelData.level}`, inline: true },
                    { name: 'Progress to Next Level', value: `\`[${progressBar}]\` ${percent}%` },
                    { name: 'XP', value: `${levelData.xp} / ${xpNeeded} XP`, inline: true }
                )
                .setTimestamp();

            await interaction.editReply({ embeds: [rankEmbed] });
        } catch (error) {
            console.error('Error fetching rank card:', error);
            await interaction.editReply('❌ An error occurred while retrieving the rank card.');
        }
    },
};
