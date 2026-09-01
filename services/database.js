const mongoose = require('mongoose');

// Define Schema for general key-value store
const storeSchema = new mongoose.Schema({
    key: { type: String, required: true, unique: true },
    value: { type: mongoose.Schema.Types.Mixed, required: true }
}, { timestamps: true });

const Store = mongoose.model('Store', storeSchema);

// Define Schema for Guild Configuration
const guildConfigSchema = new mongoose.Schema({
    guildId: { type: String, required: true, unique: true },
    welcomeChannelId: { type: String },
    logChannelId: { type: String },
    ticketCategoryId: { type: String }
}, { timestamps: true });

const GuildConfig = mongoose.model('GuildConfig', guildConfigSchema);

// Define Schema for Leveling System
const levelSchema = new mongoose.Schema({
    guildId: { type: String, required: true },
    userId: { type: String, required: true },
    xp: { type: Number, default: 0 },
    level: { type: Number, default: 0 },
    lastMessageTimestamp: { type: Date, default: 0 }
}, { timestamps: true });

levelSchema.index({ guildId: 1, userId: 1 }, { unique: true });

const Level = mongoose.model('Level', levelSchema);

// Define Schema for User Profile & Settings
const userProfileSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    username: { type: String, required: true },
    preferredLanguage: { type: String, default: 'English' },
    notificationsEnabled: { type: Boolean, default: true },
    timezone: { type: String, default: 'UTC' }
}, { timestamps: true });

const UserProfile = mongoose.model('UserProfile', userProfileSchema);

// Define Schema for Long-Term Memory
const memorySchema = new mongoose.Schema({
    userId: { type: String, required: true },
    guildId: { type: String, default: null },
    key: { type: String, required: true },
    value: { type: mongoose.Schema.Types.Mixed, required: true },
    category: {
        type: String,
        enum: ['preference', 'profile', 'project', 'goal', 'instruction', 'context', 'other'],
        default: 'other'
    },
    importance: { type: Number, min: 1, max: 10, default: 5 },
    source: { type: String, default: 'conversation' },
    lastAccessedAt: { type: Date, default: Date.now }
}, { timestamps: true });

// Indexes
memorySchema.index({ userId: 1, key: 1 }, { unique: true });
memorySchema.index({ guildId: 1 });
memorySchema.index({ lastAccessedAt: -1 });

const Memory = mongoose.model('Memory', memorySchema);

// Define Schema for Moderation Logs
const moderationLogSchema = new mongoose.Schema({
    userId: { type: String, required: true },
    guildId: { type: String, required: true },
    messageId: { type: String, required: true },
    content: { type: String }, // Stored temporarily or hashed, but useful for logs
    category: { type: String },
    severity: { type: String, enum: ['low', 'medium', 'high'] },
    confidence: { type: Number },
    actionTaken: { type: String },
    timestamp: { type: Date, default: Date.now }
});

moderationLogSchema.index({ guildId: 1, userId: 1 });
moderationLogSchema.index({ timestamp: -1 });

const ModerationLog = mongoose.model('ModerationLog', moderationLogSchema);

/**
 * MongoDB database service.
 */
class DatabaseService {
    constructor() {
        this.GuildConfig = GuildConfig;
        this.Level = Level;
        this.Store = Store;
        this.UserProfile = UserProfile;
        this.Memory = Memory;
        this.ModerationLog = ModerationLog;
        this.connected = false;
        
        const mongoUri = process.env.MONGO_URI;
        if (!mongoUri) {
            console.error('DatabaseService Error: MONGO_URI is not set in environment variables.');
            return;
        }

        this.connectToDatabase(mongoUri);
    }

    async connectToDatabase(mongoUri) {
        try {
            await mongoose.connect(mongoUri);
            this.connected = true;
            console.log('DatabaseService: Connected to MongoDB.');
        } catch (error) {
            console.error('DatabaseService: MongoDB connection error:', error);
            // Retry connection after 5 seconds
            setTimeout(() => this.connectToDatabase(mongoUri), 5000);
        }
    }

    /**
     * Set a value in the store.
     * @param {string} key 
     * @param {any} value 
     */
    async set(key, value) {
        if (!this.connected) {
            throw new Error('Database is not connected. Please try again shortly.');
        }
        try {
            await Store.findOneAndUpdate(
                { key },
                { value },
                { upsert: true, new: true }
            );
            return true;
        } catch (error) {
            console.error(`DatabaseService.set Error for key "${key}":`, error);
            throw error;
        }
    }

    /**
     * Get a value from the store.
     * @param {string} key 
     * @returns {any}
     */
    async get(key) {
        if (!this.connected) {
            throw new Error('Database is not connected. Please try again shortly.');
        }
        try {
            const doc = await Store.findOne({ key });
            return doc ? doc.value : null;
        } catch (error) {
            console.error(`DatabaseService.get Error for key "${key}":`, error);
            throw error;
        }
    }

    /**
     * Delete a value from the store.
     * @param {string} key 
     */
    async delete(key) {
        if (!this.connected) {
            throw new Error('Database is not connected. Please try again shortly.');
        }
        try {
            const res = await Store.deleteOne({ key });
            return res.deletedCount > 0;
        } catch (error) {
            console.error(`DatabaseService.delete Error for key "${key}":`, error);
            throw error;
        }
    }
}

module.exports = new DatabaseService();
