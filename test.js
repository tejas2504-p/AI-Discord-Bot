require('dotenv').config();
const aiService = require('./services/ai');
const databaseService = require('./services/database');

async function run() {
    try {
        const res = await aiService.generateContent("What time is it now?", [], { userId: "test" });
        console.log("RESULT:", res);
        process.exit(0);
    } catch(e) {
        console.error("ERROR:");
        console.error(e.message);
        if(e.apiResponse) console.error("API Response:", e.apiResponse);
        if(e.status) console.error("Status:", e.status);
        console.error(e.stack);
        process.exit(1);
    }
}
run();
