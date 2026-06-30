const { Events } = require('discord.js');

module.exports = {
    name: Events.ShardError,
    execute(error, shardId) {
        console.error(`Shard ${shardId} encountered an error:`, error);
    },
};
