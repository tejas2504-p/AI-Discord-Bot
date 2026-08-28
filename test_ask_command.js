require('dotenv').config();
const aiService = require('./services/ai');
const routerService = require('./services/router');

async function testQuery(testNum, prompt) {
    console.log(`\n==================================================`);
    console.log(`[TEST ${testNum}] User prompt: "${prompt}"`);
    console.log(`==================================================`);

    const startTotal = Date.now();

    try {
        console.log(`[ASK] [Timer] Starting routing and classification...`);
        const startRoute = Date.now();
        const responseText = await routerService.route(prompt, []);
        const endRoute = Date.now();
        console.log(`[ASK] [Timer] Routing/Classification took: ${(endRoute - startRoute) / 1000}s`);
        
        console.log(`\nGemini Reply:\n${responseText}`);
    } catch (e) {
        console.error(`\nError:`, e.message);
    }

    const endTotal = Date.now();
    console.log(`[ASK] [Timer] Total turnaround time: ${(endTotal - startTotal) / 1000}s`);
}

async function main() {
    console.log("Starting URGENT BUG FIX /ask Command Test Suite...");

    // Test 1: Direct answer, no search
    await testQuery(1, "What is Java?");

    console.log("\nWaiting 15 seconds to avoid rate limits...");
    await new Promise(resolve => setTimeout(resolve, 15000));

    // Test 2: Date check (should use getCurrentDateTime)
    await testQuery(2, "What is today's date?");

    console.log("\nWaiting 15 seconds to avoid rate limits...");
    await new Promise(resolve => setTimeout(resolve, 15000));

    // Test 3: Latest AI news (should use webSearch)
    await testQuery(3, "What are the latest AI developments?");

    console.log("\n==================================================");
    console.log("All tests completed!");
    console.log("==================================================");
}

main();
