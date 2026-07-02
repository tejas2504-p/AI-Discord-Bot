const { SlashCommandBuilder } = require('discord.js');
const aiService = require('../services/ai');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('debug')
        .setDescription('Analyze a programming code snippet for bugs, issues, or optimizations.')
        .addStringOption(option =>
            option.setName('code')
                .setDescription('The code snippet to debug')
                .setRequired(true)),
    async execute(interaction) {
        const code = interaction.options.getString('code');
        
        await interaction.deferReply();

        try {
            const prompt = `You are a professional software engineer and debugger. Analyze the following code snippet. Identify any bugs, syntax errors, security vulnerabilities, or performance issues. Suggest clear, optimized fixes and provide the corrected code.

Code snippet to analyze:
\`\`\`
${code}
\`\`\`
Provide a structured analysis with headers for "Identified Issues", "Suggested Corrections", and "Optimized Code".`;

            const aiResponse = await aiService.generateContent(prompt);
            
            if (aiResponse.length > 2000) {
                await interaction.editReply(aiResponse.slice(0, 1900) + '\n\n*(Truncated due to length)*');
            } else {
                await interaction.editReply(aiResponse);
            }
        } catch (error) {
            console.error('Error in debug command:', error);
            await interaction.editReply(error.message || 'An error occurred while analyzing the code snippet.');
        }
    },
};
