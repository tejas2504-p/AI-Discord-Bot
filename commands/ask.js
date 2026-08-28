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
        console.log('[ASK 1] Command received');
        
        try {
            // Defer the reply immediately before any database or API calls
            await interaction.deferReply();
            console.log('[ASK 2] Discord interaction deferred');

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

            // A single /ask request must NEVER remain in "thinking" indefinitely.
            // Add a global safety timeout of 40 seconds.
            const TIMEOUT_MS = 40000;
            let timeoutId;
            const timeoutPromise = new Promise((_, reject) => {
                timeoutId = setTimeout(() => {
                    reject(new Error("ASK_GLOBAL_TIMEOUT"));
                }, TIMEOUT_MS);
            });

            // Call intelligent router with timeout race
            const routePromise = routerService.route(prompt, history);
            const responseText = await Promise.race([routePromise, timeoutPromise]);
            clearTimeout(timeoutId);
            
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

            console.log('[ASK 10] Sending Discord response');
            
            // Discord message limit is 2000 characters
            if (responseText.length > 2000) {
                const truncated = responseText.slice(0, 1900) + '\n\n*(Truncated due to Discord 2000-character limit)*';
                await interaction.editReply(truncated);
            } else {
                await interaction.editReply(responseText);
            }
            console.log('[ASK 11] Discord response completed');
        } catch (error) {
            console.error("[ASK ERROR]", error);
            
            let userMessage = "Sorry, I couldn't process your request right now.";
            if (error.message === "ASK_GLOBAL_TIMEOUT") {
                userMessage = "Sorry, the AI service took too long to respond. Please try again.";
            }

            try {
                if (interaction.deferred || interaction.replied) {
                    await interaction.editReply(userMessage);
                } else {
                    await interaction.reply({ content: userMessage, ephemeral: true });
                }
            } catch (replyErr) {
                console.error("Failed to send error reply to Discord:", replyErr);
            }
        }
    },
};
