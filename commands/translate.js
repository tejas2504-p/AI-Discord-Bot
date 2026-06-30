const { SlashCommandBuilder } = require('discord.js');
const aiService = require('../services/ai');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('translate')
        .setDescription('Translate text into another language using AI.')
        .addStringOption(option =>
            option.setName('text')
                .setDescription('The text you want to translate')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('target_language')
                .setDescription('The language to translate to (e.g. Spanish, Japanese, French)')
                .setRequired(true)),
    async execute(interaction) {
        const text = interaction.options.getString('text');
        const targetLanguage = interaction.options.getString('target_language');
        
        await interaction.deferReply();

        const fullPrompt = `Translate the following text into ${targetLanguage}. Return ONLY the translated text without any conversational preamble or markdown if possible. Text to translate:\n"${text}"`;

        try {
            const aiResponse = await aiService.generateContent(fullPrompt);
            
            if (aiResponse.length > 2000) {
                const truncated = aiResponse.slice(0, 1900) + '\n\n*(Truncated due to length)*';
                await interaction.editReply(truncated);
            } else {
                await interaction.editReply(aiResponse);
            }
        } catch (error) {
            console.error('Error in translate command:', error);
            await interaction.editReply('An error occurred during translation.');
        }
    },
};
