const { SlashCommandBuilder } = require('discord.js');
const databaseService = require('../services/database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('reset')
        .setDescription('Reset your chat memory with the AI bot.'),
    async execute(interaction) {
        const historyKey = `chat_history:${interaction.user.id}`;
        
        try {
            await databaseService.delete(historyKey);
            await interaction.reply({ content: 'Your chat history has been reset!', ephemeral: true });
        } catch (error) {
            console.error('Error in reset command:', error);
            await interaction.reply({ content: 'Failed to reset your chat history.', ephemeral: true });
        }
    },
};
