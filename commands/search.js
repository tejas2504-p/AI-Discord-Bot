const { SlashCommandBuilder } = require('discord.js');
const searchService = require('../services/search');
const aiService = require('../services/ai');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('search')
        .setDescription('Search the web for real-time information.')
        .addStringOption(option =>
            option.setName('query')
                .setDescription('The search term or question to search the web for')
                .setRequired(true)),
    async execute(interaction) {
        const query = interaction.options.getString('query');
        
        await interaction.deferReply();

        try {
            const results = await searchService.search(query);
            
            if (!results || results.length === 0) {
                await interaction.editReply(`ℹ️ No search results found for: "${query}".`);
                return;
            }

            const prompt = `You are an AI assistant. The user asked for a web search about: "${query}".
Here are the recent search results we fetched:
${JSON.stringify(results)}

Format these search results into a detailed, friendly, and conversational response. Synthesize the findings, highlight key facts, and link to the sources using markdown [Title](Link) links. Keep it highly readable and clean in markdown.`;

            const aiResponse = await aiService.generateContent(prompt);
            
            if (aiResponse.length > 2000) {
                await interaction.editReply(aiResponse.slice(0, 1900) + '\n\n*(Truncated due to length)*');
            } else {
                await interaction.editReply(aiResponse);
            }
        } catch (error) {
            console.error('Error in search command:', error);
            await interaction.editReply(error.message || 'An error occurred while performing the search.');
        }
    },
};
