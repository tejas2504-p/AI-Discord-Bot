const { SlashCommandBuilder } = require('discord.js');
const aiService = require('../services/ai');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('explain')
        .setDescription('Explain a concept with analogies tailored to a specific difficulty level.')
        .addStringOption(option =>
            option.setName('concept')
                .setDescription('The concept or topic to explain')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('difficulty')
                .setDescription('The difficulty level of the explanation (default is Intermediate)')
                .setRequired(false)
                .addChoices(
                    { name: 'Beginner (ELI5 - Explain Like I\'m 5)', value: 'beginner' },
                    { name: 'Intermediate', value: 'intermediate' },
                    { name: 'Advanced', value: 'advanced' }
                )),
    async execute(interaction) {
        const concept = interaction.options.getString('concept');
        const difficulty = interaction.options.getString('difficulty') || 'intermediate';
        
        await interaction.deferReply();

        let difficultyPrompt = '';
        if (difficulty === 'beginner') {
            difficultyPrompt = "Explain like I'm 5 years old. Use simple language, fun analogies, and avoid technical jargon.";
        } else if (difficulty === 'advanced') {
            difficultyPrompt = "Provide an in-depth, technical explanation. Use precise industry terms, cover core architectural/design concepts, and details.";
        } else {
            difficultyPrompt = "Provide a balanced explanation. Use clear analogies and examples suitable for general learners.";
        }

        const prompt = `Explain the concept: "${concept}". 
Target Level: ${difficultyPrompt}
Structure your response with:
1. **High-Level Analogy / Summary**
2. **How It Works (Core Mechanics)**
3. **Common Use Cases / Example**`;

        try {
            const aiResponse = await aiService.generateContent(prompt);
            
            if (aiResponse.length > 2000) {
                const truncated = aiResponse.slice(0, 1900) + '\n\n*(Truncated due to length)*';
                await interaction.editReply(truncated);
            } else {
                await interaction.editReply(aiResponse);
            }
        } catch (error) {
            console.error('Error in explain command:', error);
            await interaction.editReply('An error occurred while generating the explanation.');
        }
    },
};
