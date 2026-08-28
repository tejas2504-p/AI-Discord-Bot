const databaseService = require('./database');

class MemoryService {
    /**
     * Save or update a memory for a user.
     */
    async saveMemory(userId, guildId, key, value, category = 'other', importance = 5) {
        if (!userId || !key || value === undefined) {
            console.warn('[MEMORY] Missing required arguments for saveMemory');
            return null;
        }

        try {
            console.log(`[MEMORY] Saving memory for user ${userId}: key="${key}"`);
            
            // Category validation
            const validCategories = ['preference', 'profile', 'project', 'goal', 'instruction', 'context', 'other'];
            const checkedCategory = validCategories.includes(category) ? category : 'other';

            const memory = await databaseService.Memory.findOneAndUpdate(
                { userId, key },
                {
                    guildId: guildId || null,
                    value,
                    category: checkedCategory,
                    importance: Math.min(Math.max(importance, 1), 10),
                    lastAccessedAt: new Date()
                },
                { upsert: true, new: true }
            );

            console.log(`[MEMORY] Saved memory ID: ${memory._id}`);
            return memory;
        } catch (error) {
            console.error('[MEMORY] Error in saveMemory:', error);
            // Safe fallback (never crash the bot)
            return null;
        }
    }

    /**
     * Search stored memories for a user.
     */
    async searchMemories(userId, guildId, query) {
        if (!userId || !query) {
            return [];
        }

        try {
            console.log(`[MEMORY] Searching memories for user ${userId}: query="${query}"`);
            
            // Build a text search regex for key and value fields
            const regex = new RegExp(query, 'i');
            const searchFilter = {
                userId,
                $or: [
                    { key: { $regex: regex } },
                    { value: { $regex: regex } }
                ]
            };

            const memories = await databaseService.Memory.find(searchFilter)
                .sort({ importance: -1, lastAccessedAt: -1 })
                .limit(5);

            if (memories.length > 0) {
                const ids = memories.map(m => m._id);
                // Touch matching memories (update lastAccessedAt)
                await databaseService.Memory.updateMany(
                    { _id: { $in: ids } },
                    { $set: { lastAccessedAt: new Date() } }
                );
            } else {
                console.log('[MEMORY] No relevant memory found');
            }

            return memories;
        } catch (error) {
            console.error('[MEMORY] Error in searchMemories:', error);
            return [];
        }
    }

    /**
     * Get a single memory by its key.
     */
    async getMemory(userId, guildId, key) {
        if (!userId || !key) {
            return null;
        }

        try {
            const memory = await databaseService.Memory.findOne({ userId, key });
            if (memory) {
                memory.lastAccessedAt = new Date();
                await memory.save();
            }
            return memory;
        } catch (error) {
            console.error('[MEMORY] Error in getMemory:', error);
            return null;
        }
    }

    /**
     * Update an existing memory value.
     */
    async updateMemory(userId, guildId, key, value) {
        if (!userId || !key || value === undefined) {
            return null;
        }

        try {
            console.log(`[MEMORY] Updating memory for user ${userId}: key="${key}"`);
            const memory = await databaseService.Memory.findOneAndUpdate(
                { userId, key },
                { value, lastAccessedAt: new Date() },
                { new: true }
            );
            
            if (memory) {
                console.log(`[MEMORY] Memory updated successfully`);
            } else {
                console.log(`[MEMORY] Memory key "${key}" not found for update`);
            }
            return memory;
        } catch (error) {
            console.error('[MEMORY] Error in updateMemory:', error);
            return null;
        }
    }

    /**
     * Delete memories (supports deleting a specific key or everything).
     */
    async deleteMemory(userId, guildId, key) {
        if (!userId || !key) {
            return false;
        }

        try {
            // Delete all user memories on "forget everything" / "all"
            if (key.toLowerCase() === '*all*' || key.toLowerCase() === 'everything' || key.toLowerCase() === 'all') {
                console.log(`[MEMORY] Deleting ALL memories for user ${userId}`);
                const res = await databaseService.Memory.deleteMany({ userId });
                return res.deletedCount > 0;
            }

            console.log(`[MEMORY] Deleting memory for user ${userId}: key="${key}"`);
            const res = await databaseService.Memory.deleteOne({ userId, key });
            if (res.deletedCount > 0) {
                console.log('[MEMORY] Memory deleted');
                return true;
            }
            
            console.log(`[MEMORY] Memory key "${key}" not found for deletion`);
            return false;
        } catch (error) {
            console.error('[MEMORY] Error in deleteMemory:', error);
            return false;
        }
    }

    /**
     * List all memories (keys and categories only) for a user.
     */
    async listMemories(userId, guildId) {
        if (!userId) {
            return [];
        }

        try {
            return await databaseService.Memory.find({ userId })
                .select('key category importance -_id')
                .sort({ key: 1 });
        } catch (error) {
            console.error('[MEMORY] Error in listMemories:', error);
            return [];
        }
    }
}

module.exports = new MemoryService();
