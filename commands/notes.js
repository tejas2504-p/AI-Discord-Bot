const { SlashCommandBuilder } = require('discord.js');
const aiService = require('../services/ai');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('notes')
        .setDescription('Generate study notes on a topic.')
        .addStringOption(option =>
            option.setName('topic')
                .setDescription('The topic to generate study notes for')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('detail_level')
                .setDescription('Level of detail for the notes (default is Detailed)')
                .setRequired(false)
                .addChoices(
                    { name: 'Detailed', value: 'detailed' },
                    { name: 'Summary', value: 'summary' }
                )),
    async execute(interaction) {
        const topic = interaction.options.getString('topic');
        const detailLevel = interaction.options.getString('detail_level') || 'detailed';
        
        await interaction.deferReply();

        const prompt = `Generate clean, structured study notes on the topic: "${topic}". Detail level: ${detailLevel}. 
Use clear Markdown formatting, bullet points, headers, and include a "Key Takeaways" section at the end.`;

        try {
            const aiResponse = await aiService.generateContent(prompt);
            
            // Discord message limit is 2000 characters
            if (aiResponse.length > 2000) {
                const truncated = aiResponse.slice(0, 1900) + '\n\n*(Truncated due to length)*';
                await interaction.editReply(truncated);
            } else {
                await interaction.editReply(aiResponse);
            }
        } catch (error) {
            console.error('Error in notes command:', error);
            await interaction.editReply('An error occurred while generating study notes.');
        }
    },
};
