const { SlashCommandBuilder } = require('discord.js');
const financeService = require('../services/finance');
const aiService = require('../services/ai');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('stocks')
        .setDescription('Get live stock ticker or cryptocurrency quotes.')
        .addStringOption(option =>
            option.setName('symbol')
                .setDescription('The stock ticker or crypto token symbol (e.g. AAPL, BTC, ETH, TSLA)')
                .setRequired(true)),
    async execute(interaction) {
        const symbol = interaction.options.getString('symbol');
        
        await interaction.deferReply();

        try {
            const quote = await financeService.getQuote(symbol);
            
            const prompt = `You are an AI financial analyst. The user requested stock/crypto price details for: "${symbol}".
Here is the real-time market data we fetched:
${JSON.stringify(quote)}

Format this market data into a conversational and professional response. Show current price, previous close, price change, percentage change, and the exchange it belongs to. Use clean formatting with appropriate markdown (like code blocks or bold tags) and status emojis (e.g., green up arrow, red down arrow).`;

            const aiResponse = await aiService.generateContent(prompt);
            
            if (aiResponse.length > 2000) {
                await interaction.editReply(aiResponse.slice(0, 1900) + '\n\n*(Truncated)*');
            } else {
                await interaction.editReply(aiResponse);
            }
        } catch (error) {
            console.error('Error in stocks command:', error);
            await interaction.editReply(error.message || 'An error occurred while fetching financial quotes.');
        }
    },
};
