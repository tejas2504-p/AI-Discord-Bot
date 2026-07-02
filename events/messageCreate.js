const { Events } = require('discord.js');
const databaseService = require('../services/database');

module.exports = {
    name: Events.MessageCreate,
    async execute(message) {
        // Ignore bot messages and direct messages
        if (!message.guild || message.author.bot) return;

        const guildId = message.guild.id;
        const userId = message.author.id;

        if (message.client.broadcastEvent) {
            message.client.broadcastEvent('messageCreate', {
                guildId: message.guild.id,
                guildName: message.guild.name,
                channelId: message.channel.id,
                channelName: message.channel.name,
                author: message.author.tag,
                authorId: message.author.id,
                content: message.content
            });
        }

        try {
            // Find or create level document for user in this guild
            let levelData = await databaseService.Level.findOne({ guildId, userId });
            
            const now = new Date();
            const xpToAdd = Math.floor(Math.random() * 11) + 15; // Random XP between 15 and 25

            if (!levelData) {
                // Initialize new user leveling data
                levelData = new databaseService.Level({
                    guildId,
                    userId,
                    xp: xpToAdd,
                    level: 0,
                    lastMessageTimestamp: now
                });
                await levelData.save();
                return;
            }

            // Check Cooldown (60 seconds)
            const timeDiff = now - new Date(levelData.lastMessageTimestamp);
            if (timeDiff < 60000) {
                return; // Still on cooldown
            }

            // Add XP and check for Level Up
            levelData.xp += xpToAdd;
            levelData.lastMessageTimestamp = now;

            const xpNeeded = 100 * (levelData.level + 1); // e.g. Level 0 -> 1 needs 100 XP, 1 -> 2 needs 200 XP...

            if (levelData.xp >= xpNeeded) {
                levelData.xp -= xpNeeded;
                levelData.level += 1;
                
                await levelData.save();

                // Send level-up message
                try {
                    await message.channel.send(`🎉 Congratulations ${message.author}! You have leveled up to **Level ${levelData.level}**!`);
                } catch (sendError) {
                    console.error('Failed to send level-up message:', sendError);
                }

                if (message.client.io) {
                    message.client.io.emit('level_up', {
                        guildId,
                        userId,
                        userTag: message.author.tag,
                        level: levelData.level,
                        timestamp: new Date()
                    });
                }
            } else {
                await levelData.save();
            }
        } catch (error) {
            console.error('Error in MessageCreate leveling system:', error);
        }
    },
};
