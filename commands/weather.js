const { SlashCommandBuilder } = require('discord.js');
const weatherService = require('../services/weather');
const aiService = require('../services/ai');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('weather')
        .setDescription('Get live weather information for a specific location.')
        .addStringOption(option =>
            option.setName('location')
                .setDescription('The city or region to query (e.g. New York, London, Paris)')
                .setRequired(true)),
    async execute(interaction) {
        const location = interaction.options.getString('location');
        
        await interaction.deferReply();

        try {
            const weatherData = await weatherService.getWeather(location);
            
            const prompt = `You are an AI weather reporter assistant. The user wants to know the weather for: "${location}".
Here is the real-time weather data we fetched:
${JSON.stringify(weatherData)}

Format this data into a helpful, conversational, and nicely structured response. Make sure to report current temperature in both C and F, conditions, wind speed, humidity, and a summary of the 3-day forecast if available. Use appropriate emojis.`;

            const aiResponse = await aiService.generateContent(prompt);
            
            if (aiResponse.length > 2000) {
                await interaction.editReply(aiResponse.slice(0, 1900) + '\n\n*(Truncated due to Discord character limit)*');
            } else {
                await interaction.editReply(aiResponse);
            }
        } catch (error) {
            console.error('Error in weather command:', error);
            await interaction.editReply(error.message || 'An error occurred while retrieving weather details.');
        }
    },
};
