const { SlashCommandBuilder } = require('discord.js');
const aiService = require('../services/ai');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('quiz')
        .setDescription('Generate a multiple-choice quiz on a topic.')
        .addStringOption(option =>
            option.setName('topic')
                .setDescription('The subject or topic for the quiz')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('questions')
                .setDescription('Number of questions (1-5, default is 3)')
                .setRequired(false)
                .setMinValue(1)
                .setMaxValue(5)),
    async execute(interaction) {
        const topic = interaction.options.getString('topic');
        const numQuestions = interaction.options.getInteger('questions') || 3;
        
        await interaction.deferReply();

        const prompt = `Create a multiple-choice quiz about "${topic}" with ${numQuestions} questions.
For each question, provide 4 options (A, B, C, D). 
At the end of the message, list the correct answers with a brief explanation for each in an "Answers & Explanations" section. Use markdown formatting.`;

        try {
            const aiResponse = await aiService.generateContent(prompt);
            
            if (aiResponse.length > 2000) {
                const truncated = aiResponse.slice(0, 1900) + '\n\n*(Truncated due to length)*';
                await interaction.editReply(truncated);
            } else {
                await interaction.editReply(aiResponse);
            }
        } catch (error) {
            console.error('Error in quiz command:', error);
            await interaction.editReply('An error occurred while generating the quiz.');
        }
    },
};
