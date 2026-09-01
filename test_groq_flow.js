require('dotenv').config();
const aiService = require('./services/ai');

async function runTests() {
    console.log("--- TEST 1: Normal Question ---");
    const res1 = await aiService.generateContentGroq("What is Java?", [], { userId: "testUser1" });
    console.log("Result 1:", res1.substring(0, 100) + "...\n");

    console.log("--- TEST 2: Current Date ---");
    const res2 = await aiService.generateContentGroq("What is today's date?", [], { userId: "testUser2" });
    console.log("Result 2:", res2.substring(0, 100) + "...\n");

    console.log("--- TEST 3: Web Search ---");
    const res3 = await aiService.generateContentGroq("What are the latest AI news?", [], { userId: "testUser3" });
    console.log("Result 3:", res3.substring(0, 100) + "...\n");
}

runTests().catch(console.error);
