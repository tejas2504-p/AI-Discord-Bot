const { SlashCommandBuilder } = require('discord.js');
const routerService = require('../services/router');
const databaseService = require('../services/database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ask')
        .setDescription('Ask the AI assistant a question (supports weather, news, sports, stocks, crypto).')
        .addStringOption(option =>
            option.setName('prompt')
                .setDescription('The question or prompt to ask the AI')
                .setRequired(true)),
    async execute(interaction) {
        console.log('[ASK] command received');
        
        try {
            // Defer the reply immediately before any database or API calls
            await interaction.deferReply();
            console.log('[ASK] interaction deferred');

            const prompt = interaction.options.getString('prompt');
            const userId = interaction.user.id;

            // Ensure User Profile exists
            let profile = await databaseService.UserProfile.findOne({ userId });
            if (!profile) {
                profile = new databaseService.UserProfile({
                    userId,
                    username: interaction.user.username
                });
                await profile.save();
            }

            const historyKey = `chat_history:${userId}`;
            let history = await databaseService.get(historyKey) || [];

            console.log('[ASK] sending request to Gemini');
            
            // Call intelligent router
            const responseText = await routerService.route(prompt, history);
            console.log('[ASK] final Gemini response received');
            
            // Append successful turn to history
            history.push({
                role: 'user',
                parts: [{ text: prompt }]
            });
            history.push({
                role: 'model',
                parts: [{ text: responseText }]
            });

            // Limit history to the last 20 messages (10 rounds of back-and-forth)
            const MAX_HISTORY = 20;
            if (history.length > MAX_HISTORY) {
                history = history.slice(history.length - MAX_HISTORY);
            }

            await databaseService.set(historyKey, history);

            // Discord message limit is 2000 characters
            if (responseText.length > 2000) {
                const truncated = responseText.slice(0, 1900) + '\n\n*(Truncated due to Discord 2000-character limit)*';
                await interaction.editReply(truncated);
            } else {
                await interaction.editReply(responseText);
            }
            console.log('[ASK] Discord response sent');
        } catch (error) {
            console.error("[ASK ERROR]", error);
            try {
                // Securely notify user without exposing stack traces or API keys
                await interaction.editReply("Sorry, I couldn't process your request right now.");
            } catch (replyErr) {
                console.error("Failed to send error reply to Discord:", replyErr);
            }
        }
    },
};
