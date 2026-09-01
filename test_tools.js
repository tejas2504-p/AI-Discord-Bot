const aiService = require('./services/ai');
const dotenv = require('dotenv');
dotenv.config();

async function run() {
    try {
        console.log("Testing existing tool (time):");
        const res1 = await aiService.generateContent("What time is it now?", [], { userId: "test", disableTools: false });
        console.log("Result:", res1.substring(0, 50));

        console.log("\nTesting Discord Action prompt (no interaction object mock):");
        // We will not provide interaction, so it should hit the safety check and return "Missing interaction object"
        const res2 = await aiService.generateContent("What is the server info? Get it using your discord tools.", [], { userId: "test", disableTools: false });
        console.log("Result:", res2.substring(0, 100));
        process.exit(0);
    } catch (e) {
        console.error("Test failed:", e);
        process.exit(1);
    }
}
run();
