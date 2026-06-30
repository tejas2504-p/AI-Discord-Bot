const { SlashCommandBuilder } = require('discord.js');
const aiService = require('../services/ai');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('code')
        .setDescription('Generate or explain programming code using AI.')
        .addStringOption(option =>
            option.setName('language')
                .setDescription('The programming language (e.g. JavaScript, Python, C++)')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('prompt')
                .setDescription('What code to generate or explain')
                .setRequired(true)),
    async execute(interaction) {
        const language = interaction.options.getString('language');
        const prompt = interaction.options.getString('prompt');
        
        await interaction.deferReply();

        const fullPrompt = `You are a code generation and explanation assistant. Language: ${language}. Prompt: ${prompt}. Please provide clear code with comments, followed by a concise explanation.`;

        try {
            const aiResponse = await aiService.generateContent(fullPrompt);
            
            if (aiResponse.length > 2000) {
                const truncated = aiResponse.slice(0, 1900) + '\n\n*(Truncated due to length)*';
                await interaction.editReply(truncated);
            } else {
                await interaction.editReply(aiResponse);
            }
        } catch (error) {
            console.error('Error in code command:', error);
            await interaction.editReply('An error occurred while generating code.');
        }
    },
};
