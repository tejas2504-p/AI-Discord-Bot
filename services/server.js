const express = require('express');
const cors = require('cors');
const databaseService = require('./database');

module.exports = function startServer(client) {
    const app = express();
    const port = process.env.PORT || 3001;

    app.use(cors());
    app.use(express.json());

    // 1. Bot status & metadata
    app.get('/api/status', (req, res) => {
        res.json({
            status: client.isReady() ? 'online' : 'offline',
            uptime: Math.floor(client.uptime / 1000), // in seconds
            guilds: client.guilds.cache.size,
            ping: client.ws.ping,
            user: client.user ? {
                tag: client.user.tag,
                avatar: client.user.displayAvatarURL()
            } : null
        });
    });

    // 2. Guilds list
    app.get('/api/guilds', (req, res) => {
        const guilds = client.guilds.cache.map(guild => ({
            id: guild.id,
            name: guild.name,
            icon: guild.iconURL({ dynamic: true }) || null,
            memberCount: guild.memberCount
        }));
        res.json(guilds);
    });

    // 3. Guild configuration (welcome, logs, tickets settings)
    app.get('/api/config/:guildId', async (req, res) => {
        try {
            const { guildId } = req.params;
            const config = await databaseService.GuildConfig.findOne({ guildId });
            
            const guild = client.guilds.cache.get(guildId);
            if (!guild) {
                return res.status(404).json({ error: 'Guild not found.' });
            }

            const channels = guild.channels.cache
                .filter(ch => ch.type === 0) // GuildText
                .map(ch => ({ id: ch.id, name: ch.name }));

            const categories = guild.channels.cache
                .filter(ch => ch.type === 4) // GuildCategory
                .map(ch => ({ id: ch.id, name: ch.name }));

            res.json({
                config: config || { guildId, welcomeChannelId: null, logChannelId: null, ticketCategoryId: null },
                channels,
                categories
            });
        } catch (error) {
            console.error('Error fetching guild config:', error);
            res.status(500).json({ error: 'Failed to fetch guild configuration.' });
        }
    });

    // 4. Update Guild configuration
    app.post('/api/config/:guildId', async (req, res) => {
        try {
            const { guildId } = req.params;
            const { welcomeChannelId, logChannelId, ticketCategoryId } = req.body;

            const updated = await databaseService.GuildConfig.findOneAndUpdate(
                { guildId },
                { welcomeChannelId, logChannelId, ticketCategoryId },
                { upsert: true, new: true }
            );

            res.json({ success: true, config: updated });
        } catch (error) {
            console.error('Error updating guild config:', error);
            res.status(500).json({ error: 'Failed to update guild configuration.' });
        }
    });

    // 5. Retrieve all User Chat Histories
    app.get('/api/history', async (req, res) => {
        try {
            const Store = databaseService.Store;
            const chatHistories = await Store.find({ key: { $regex: /^chat_history:/ } });
            const interviewHistories = await Store.find({ key: { $regex: /^interview:/ } });

            const formatted = [];

            for (const doc of chatHistories) {
                const userId = doc.key.split(':')[1];
                let userTag = userId;
                try {
                    const user = await client.users.fetch(userId);
                    userTag = user.tag;
                } catch {}
                
                formatted.push({
                    type: 'chat',
                    userId,
                    userTag,
                    history: doc.value
                });
            }

            for (const doc of interviewHistories) {
                const userId = doc.key.split(':')[1];
                let userTag = userId;
                try {
                    const user = await client.users.fetch(userId);
                    userTag = user.tag;
                } catch {}

                formatted.push({
                    type: 'interview',
                    userId,
                    userTag,
                    history: doc.value.history,
                    topic: doc.value.topic,
                    difficulty: doc.value.difficulty,
                    questionCount: doc.value.questionCount
                });
            }

            res.json(formatted);
        } catch (error) {
            console.error('Error fetching chat histories:', error);
            res.status(500).json({ error: 'Failed to fetch chat history logs.' });
        }
    });

    // 6. Leveling Stats
    app.get('/api/levels/:guildId', async (req, res) => {
        try {
            const { guildId } = req.params;
            const levels = await databaseService.Level.find({ guildId }).sort({ level: -1, xp: -1 });
            
            const formatted = [];
            for (const item of levels) {
                let userTag = item.userId;
                try {
                    const user = await client.users.fetch(item.userId);
                    userTag = user.tag;
                } catch {}

                formatted.push({
                    userId: item.userId,
                    userTag,
                    xp: item.xp,
                    level: item.level,
                    lastActive: item.lastMessageTimestamp
                });
            }
            res.json(formatted);
        } catch (error) {
            console.error('Error fetching leveling details:', error);
            res.status(500).json({ error: 'Failed to fetch server ranks.' });
        }
    });

    app.listen(port, () => {
        console.log(`[API Server] Express server listening on port ${port}`);
    });
};
