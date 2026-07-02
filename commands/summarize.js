const { SlashCommandBuilder } = require('discord.js');
const aiService = require('../services/ai');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('summarize')
        .setDescription('Create a concise summary of a long block of text.')
        .addStringOption(option =>
            option.setName('text')
                .setDescription('The long text block to summarize')
                .setRequired(true)),
    async execute(interaction) {
        const text = interaction.options.getString('text');
        
        await interaction.deferReply();

        try {
            const prompt = `You are a text summarization assistant. Summarize the following text block concisely. Highlight the key points and core takeaways. Keep the summary structured and easy to read.

Text to summarize:
"${text}"`;

            const aiResponse = await aiService.generateContent(prompt);
            
            if (aiResponse.length > 2000) {
                await interaction.editReply(aiResponse.slice(0, 1900) + '\n\n*(Truncated)*');
            } else {
                await interaction.editReply(aiResponse);
            }
        } catch (error) {
            console.error('Error in summarize command:', error);
            await interaction.editReply(error.message || 'An error occurred while generating the summary.');
        }
    },
};
