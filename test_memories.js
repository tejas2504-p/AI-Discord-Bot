require('dotenv').config();
const databaseService = require('./services/database');
async function run() {
    const memories = await databaseService.Memory.find({});
    console.log("All memories in DB:");
    console.log(memories);
    process.exit(0);
}
run();
