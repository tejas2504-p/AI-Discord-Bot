require('dotenv').config();
const modService = require('./services/moderation');

async function test() {
    console.log("Testing Safe Message...");
    const res1 = await modService.callAI('Hello everyone, how are you today?');
    console.log(res1);

    console.log("\nTesting Toxic Message...");
    const res2 = await modService.callAI('You are all stupid and I hate this server. Go away idiot.');
    console.log(res2);
    
    console.log("\nTesting Spam Message...");
    const res3 = await modService.callAI('BUY CHEAP NITRO NOW AT http://scam.com BUY CHEAP NITRO NOW AT http://scam.com');
    console.log(res3);
}

test();
