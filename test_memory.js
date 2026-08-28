require('dotenv').config();
const mongoose = require('mongoose');
const memoryService = require('./services/memory');
const databaseService = require('./services/database');

async function runTests() {
    console.log('=== STARTING LONG-TERM MEMORY TOOL TESTS ===');

    // Wait for MongoDB to connect
    if (mongoose.connection.readyState !== 1) {
        console.log('Waiting for MongoDB connection...');
        await new Promise((resolve) => {
            const check = setInterval(() => {
                if (mongoose.connection.readyState === 1) {
                    clearInterval(check);
                    resolve();
                }
            }, 100);
        });
    }
    console.log('Database connected. Clearing previous test memories...');
    await databaseService.Memory.deleteMany({ userId: { $in: ['test_user_a', 'test_user_b'] } });

    // Test 1: Save Memory
    console.log('\n--- Test 1: Save Memory ---');
    const m1 = await memoryService.saveMemory(
        'test_user_a',
        'guild_123',
        'favorite_language',
        'JavaScript',
        'preference',
        8
    );
    if (m1 && m1.key === 'favorite_language' && m1.value === 'JavaScript') {
        console.log('✅ Test 1 Passed: Memory saved successfully.');
    } else {
        console.error('❌ Test 1 Failed:', m1);
    }

    // Test 2: Duplicate Key Upsert Prevention
    console.log('\n--- Test 2: Duplicate Prevention (Upsert) ---');
    const m2 = await memoryService.saveMemory(
        'test_user_a',
        'guild_123',
        'favorite_language',
        'TypeScript',
        'preference',
        9
    );
    const docCount = await databaseService.Memory.countDocuments({ userId: 'test_user_a', key: 'favorite_language' });
    if (docCount === 1 && m2.value === 'TypeScript' && m2.importance === 9) {
        console.log('✅ Test 2 Passed: Correctly updated existing key rather than creating a duplicate.');
    } else {
        console.error('❌ Test 2 Failed: Count =', docCount, 'Value =', m2?.value);
    }

    // Test 3: Search Memory
    console.log('\n--- Test 3: Search Memories ---');
    await memoryService.saveMemory('test_user_a', 'guild_123', 'project_goal', 'Build a secure AI agent bot', 'goal', 7);
    const searchResults = await memoryService.searchMemories('test_user_a', 'guild_123', 'AI agent');
    if (searchResults.length > 0 && searchResults[0].key === 'project_goal') {
        console.log('✅ Test 3 Passed: Search query successfully retrieved the goal memory.');
    } else {
        console.error('❌ Test 3 Failed:', searchResults);
    }

    // Test 4: User Isolation
    console.log('\n--- Test 4: User Isolation ---');
    // Save memory for user B
    await memoryService.saveMemory('test_user_b', 'guild_123', 'favorite_language', 'Python', 'preference', 8);
    // User A searches for "Python"
    const searchA = await memoryService.searchMemories('test_user_a', 'guild_123', 'Python');
    // User B searches for "TypeScript"
    const searchB = await memoryService.searchMemories('test_user_b', 'guild_123', 'TypeScript');

    if (searchA.length === 0 && searchB.length === 0) {
        console.log('✅ Test 4 Passed: Absolute isolation confirmed. Users cannot access each other\'s memory.');
    } else {
        console.error('❌ Test 4 Failed: Leak detected! A search result =', searchA, 'B search result =', searchB);
    }

    // Test 5: Delete Memory (Single Key)
    console.log('\n--- Test 5: Delete Memory (Single Key) ---');
    const deleteRes = await memoryService.deleteMemory('test_user_a', 'guild_123', 'favorite_language');
    const fetchDeleted = await memoryService.getMemory('test_user_a', 'guild_123', 'favorite_language');
    if (deleteRes === true && fetchDeleted === null) {
        console.log('✅ Test 5 Passed: Successfully deleted individual memory key.');
    } else {
        console.error('❌ Test 5 Failed: deleteRes =', deleteRes, 'fetchDeleted =', fetchDeleted);
    }

    // Test 6: Delete Memory (All / Wipe)
    console.log('\n--- Test 6: Wipe All Memories for User ---');
    await memoryService.saveMemory('test_user_a', 'guild_123', 'profile_name', 'Tejas', 'profile', 5);
    await memoryService.saveMemory('test_user_a', 'guild_123', 'profile_color', 'blue', 'preference', 5);
    
    const wipeRes = await memoryService.deleteMemory('test_user_a', 'guild_123', 'everything');
    const userAMemories = await memoryService.listMemories('test_user_a', 'guild_123');
    const userBMemories = await memoryService.listMemories('test_user_b', 'guild_123');

    if (wipeRes === true && userAMemories.length === 0 && userBMemories.length > 0) {
        console.log('✅ Test 6 Passed: Successfully wiped all User A records while retaining User B records.');
    } else {
        console.error('❌ Test 6 Failed: userA length =', userAMemories.length, 'userB length =', userBMemories.length);
    }

    // Clean up database
    await databaseService.Memory.deleteMany({ userId: { $in: ['test_user_a', 'test_user_b'] } });
    console.log('\nDatabase cleaned up.');
    console.log('=== ALL TESTS COMPLETED ===');
    mongoose.connection.close();
}

runTests().catch(err => {
    console.error('Tests crashed:', err);
    mongoose.connection.close();
});
