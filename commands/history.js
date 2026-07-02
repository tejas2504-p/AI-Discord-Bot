const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const databaseService = require('../services/database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('history')
        .setDescription('View your recent AI assistant conversation history details.'),
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        try {
            const userId = interaction.user.id;
            const historyKey = `chat_history:${userId}`;
            const history = await databaseService.get(historyKey) || [];

            if (history.length === 0) {
                await interaction.editReply('ℹ️ You do not have any active conversation history stored in the database. Send a prompt using `/ask` to start!');
                return;
            }

            // Retrieve user profile for additional stats/context
            const profile = await databaseService.UserProfile.findOne({ userId });
            const language = profile ? profile.preferredLanguage : 'English';
            
            const historyEmbed = new EmbedBuilder()
                .setTitle(`📊 Conversation History: ${interaction.user.username}`)
                .setDescription(`Showing your last **${history.length}** messages (up to 10 back-and-forth turns).`)
                .setColor('#0066cc')
                .addFields(
                    { name: '🌐 Preferred Language', value: language, inline: true },
                    { name: '💬 Total Turns Stored', value: `${history.length / 2} rounds`, inline: true }
                )
                .setTimestamp();

            // Preview last 5 turns (max 10 items) to keep the embed clean
            const previewItems = history.slice(-10);
            let index = 1;

            for (let i = 0; i < previewItems.length; i += 2) {
                const userMsg = previewItems[i];
                const modelMsg = previewItems[i + 1];

                if (userMsg && modelMsg) {
                    const promptText = userMsg.parts[0]?.text || '';
                    const replyText = modelMsg.parts[0]?.text || '';

                    // Clean and truncate prompts/replies for the embed field
                    const cleanPrompt = promptText.length > 200 ? promptText.slice(0, 197) + '...' : promptText;
                    const cleanReply = replyText.length > 400 ? replyText.slice(0, 397) + '...' : replyText;

                    historyEmbed.addFields({
                        name: `Round ${index++}`,
                        value: `👤 **User:** ${cleanPrompt}\n🤖 **Assistant:** ${cleanReply}`
                    });
                }
            }

            await interaction.editReply({ embeds: [historyEmbed] });
        } catch (error) {
            console.error('Error in history command:', error);
            await interaction.editReply('❌ Failed to retrieve your conversation history.');
        }
    },
};
