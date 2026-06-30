const { SlashCommandBuilder } = require('discord.js');
const aiService = require('../services/ai');
const databaseService = require('../services/database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ask')
        .setDescription('Ask the AI bot any question.')
        .addStringOption(option =>
            option.setName('prompt')
                .setDescription('The question or prompt to ask the AI')
                .setRequired(true)),
    async execute(interaction) {
        const prompt = interaction.options.getString('prompt');
        
        // Defer the reply since AI generation might take longer than 3 seconds
        await interaction.deferReply();

        try {
            const historyKey = `chat_history:${interaction.user.id}`;
            let history = await databaseService.get(historyKey) || [];

            const aiResponse = await aiService.generateContent(prompt, history);
            
            // Append successful turn to history
            history.push({
                role: 'user',
                parts: [{ text: prompt }]
            });
            history.push({
                role: 'model',
                parts: [{ text: aiResponse }]
            });

            // Limit history to the last 20 messages (10 rounds of back-and-forth)
            const MAX_HISTORY = 20;
            if (history.length > MAX_HISTORY) {
                history = history.slice(history.length - MAX_HISTORY);
            }

            await databaseService.set(historyKey, history);

            // Discord message limit is 2000 characters
            if (aiResponse.length > 2000) {
                const truncated = aiResponse.slice(0, 1900) + '\n\n*(Truncated due to Discord 2000-character limit)*';
                await interaction.editReply(truncated);
            } else {
                await interaction.editReply(aiResponse);
            }
        } catch (error) {
            console.error('Error in ask command:', error);
            await interaction.editReply(error.message || 'An error occurred while processing your request.');
        }
    },
};
