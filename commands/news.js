const { SlashCommandBuilder } = require('discord.js');
const newsService = require('../services/news');
const aiService = require('../services/ai');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('news')
        .setDescription('Get live news headlines and summaries on a specific topic.')
        .addStringOption(option =>
            option.setName('topic')
                .setDescription('The topic or keywords to search for (e.g. technology, politics, sports)')
                .setRequired(true)),
    async execute(interaction) {
        const topic = interaction.options.getString('topic');
        
        await interaction.deferReply();

        try {
            const articles = await newsService.getNews(topic);
            
            if (!articles || articles.length === 0) {
                await interaction.editReply(`ℹ️ No recent news articles found for topic: "${topic}".`);
                return;
            }

            const prompt = `You are an AI news reporter. The user asked for news about: "${topic}".
Here are the recent articles we fetched:
${JSON.stringify(articles)}

Write a professional, readable news digest summarizing these headlines. Include markdown links to the sources (e.g. [Title](Link) - Source). Emphasize key facts if any. Format nicely in markdown.`;

            const aiResponse = await aiService.generateContent(prompt);
            
            if (aiResponse.length > 2000) {
                await interaction.editReply(aiResponse.slice(0, 1900) + '\n\n*(Truncated due to length)*');
            } else {
                await interaction.editReply(aiResponse);
            }
        } catch (error) {
            console.error('Error in news command:', error);
            await interaction.editReply(error.message || 'An error occurred while fetching news articles.');
        }
    },
};
