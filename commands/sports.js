const { SlashCommandBuilder } = require('discord.js');
const sportsService = require('../services/sports');
const aiService = require('../services/ai');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('sports')
        .setDescription('Get live sports headlines, scores, or team updates.')
        .addStringOption(option =>
            option.setName('query')
                .setDescription('The sports team or game name to search for (e.g. Chelsea, Liverpool, Football)')
                .setRequired(true)),
    async execute(interaction) {
        const query = interaction.options.getString('query');
        
        await interaction.deferReply();

        try {
            const sportsData = await sportsService.getSports(query);
            
            if (!sportsData || sportsData.length === 0) {
                await interaction.editReply(`ℹ️ No recent sports details or fixtures found for: "${query}".`);
                return;
            }

            const prompt = `You are an AI sports caster. The user asked for sports information regarding: "${query}".
Here are the recent articles/scores we fetched:
${JSON.stringify(sportsData)}

Format this data into a conversational and engaging sports report. Include markdown links to the sources (e.g. [Title](Link)). Make it structured and exciting.`;

            const aiResponse = await aiService.generateContent(prompt);
            
            if (aiResponse.length > 2000) {
                await interaction.editReply(aiResponse.slice(0, 1900) + '\n\n*(Truncated)*');
            } else {
                await interaction.editReply(aiResponse);
            }
        } catch (error) {
            console.error('Error in sports command:', error);
            await interaction.editReply(error.message || 'An error occurred while fetching sports information.');
        }
    },
};
