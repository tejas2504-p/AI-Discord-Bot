const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const databaseService = require('./database');

module.exports = function startServer(client) {
    const app = express();
    const server = http.createServer(app);
    const io = new Server(server, {
        cors: {
            origin: "*",
            methods: ["GET", "POST"]
        }
    });

    client.io = io; 

    // In-memory buffer to store the last 50 events so clients get log history on connection/refresh
    const eventBuffer = [];
    const MAX_BUFFER_SIZE = 50;

    client.broadcastEvent = (type, data) => {
        const event = {
            type,
            timestamp: new Date(),
            ...data
        };
        eventBuffer.push(event);
        if (eventBuffer.length > MAX_BUFFER_SIZE) {
            eventBuffer.shift();
        }
        io.emit('bot_event', event);
    };

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

    // Socket.IO event handling
    io.on('connection', (socket) => {
        console.log(`[Socket.IO] Client connected: ${socket.id}`);

        // Helper to format status
        const getStatus = () => ({
            status: client.isReady() ? 'online' : 'offline',
            uptime: Math.floor(client.uptime / 1000), // in seconds
            guilds: client.guilds.cache.size,
            ping: client.ws.ping,
            user: client.user ? {
                tag: client.user.tag,
                avatar: client.user.displayAvatarURL()
            } : null
        });

        // Send initial status and cached events
        socket.emit('bot_status', getStatus());
        socket.emit('recent_events', eventBuffer);

        // Get text channels for a guild
        socket.on('get_channels', async (guildId) => {
            try {
                const guild = client.guilds.cache.get(guildId);
                if (!guild) {
                    socket.emit('channels_list', { guildId, error: 'Guild not found', channels: [] });
                    return;
                }
                const channels = guild.channels.cache
                    .filter(ch => ch.type === 0) // GuildText
                    .map(ch => ({ id: ch.id, name: ch.name }));
                socket.emit('channels_list', { guildId, channels });
            } catch (e) {
                socket.emit('channels_list', { guildId, error: e.message, channels: [] });
            }
        });

        // Send message from dashboard bot dispatcher
        socket.on('send_message', async ({ guildId, channelId, content }) => {
            try {
                const guild = client.guilds.cache.get(guildId);
                if (!guild) {
                    socket.emit('message_error', { error: 'Server context not found' });
                    return;
                }
                const channel = guild.channels.cache.get(channelId);
                if (!channel || !channel.isTextBased()) {
                    socket.emit('message_error', { error: 'Channel not found or not text-based' });
                    return;
                }
                const sentMsg = await channel.send(content);
                socket.emit('message_success', { 
                    messageId: sentMsg.id, 
                    channelId, 
                    content,
                    timestamp: sentMsg.createdAt 
                });

                // Emit and cache event using helper
                client.broadcastEvent('messageCreate', {
                    guildId,
                    guildName: guild.name,
                    channelId,
                    channelName: channel.name,
                    author: `${client.user.tag} (Sent from Dashboard)`,
                    content: content
                });
            } catch (e) {
                socket.emit('message_error', { error: e.message });
            }
        });

        socket.on('disconnect', () => {
            console.log(`[Socket.IO] Client disconnected: ${socket.id}`);
        });
    });

    // Broadcast bot status & ping statistics every 3 seconds
    const statusInterval = setInterval(() => {
        if (client.isReady()) {
            io.emit('bot_status', {
                status: 'online',
                uptime: Math.floor(client.uptime / 1000),
                guilds: client.guilds.cache.size,
                ping: client.ws.ping,
                user: client.user ? {
                    tag: client.user.tag,
                    avatar: client.user.displayAvatarURL()
                } : null
            });
        } else {
            io.emit('bot_status', {
                status: 'offline',
                uptime: 0,
                guilds: 0,
                ping: 999,
                user: null
            });
        }
    }, 3000);

    server.listen(port, () => {
        console.log(`[API Server] Express & Socket.IO server listening on port ${port}`);
    });
};
