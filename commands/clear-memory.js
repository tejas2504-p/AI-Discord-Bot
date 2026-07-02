const { SlashCommandBuilder } = require('discord.js');
const databaseService = require('../services/database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('clear-memory')
        .setDescription('Clear your stored AI assistant conversation history from the database.'),
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        try {
            const historyKey = `chat_history:${interaction.user.id}`;
            const deleted = await databaseService.delete(historyKey);

            if (deleted) {
                await interaction.editReply('✅ Your conversation memory has been cleared successfully.');
            } else {
                await interaction.editReply('ℹ️ You do not have any active conversation history stored in the database.');
            }
        } catch (error) {
            console.error('Error in clear-memory command:', error);
            await interaction.editReply('❌ Failed to clear your conversation history. Please try again later.');
        }
    },
};
