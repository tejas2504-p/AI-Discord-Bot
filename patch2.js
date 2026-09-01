const fs = require('fs');
let c = fs.readFileSync('services/ai.js', 'utf8');

c = c.replace(
    'if (!options.disableTools) {\n            systemInstruction += ` You have tools for web search, current time, and memory. Only use webSearch for recent/live data. Only use getCurrentDateTime for time queries. Otherwise, answer directly. Keep answers concise.`;',
    'if (!options.disableTools) {\n            systemInstruction += ` You have tools for web search, current time, memory management, and performing Discord actions (creating channels, assigning roles, deleting messages, etc). Use the Discord tools to fulfill user requests for server management when explicitly asked.`;'
);

c = c.replace(
    'if (!options.disableTools) {\n            systemInstruction += ` You have tools for web search, current time, and memory. Only use webSearch for recent/live data. Only use getCurrentDateTime for time queries. Otherwise, answer directly. Keep answers concise.`;',
    'if (!options.disableTools) {\n            systemInstruction += ` You have tools for web search, current time, memory management, and performing Discord actions (creating channels, assigning roles, deleting messages, etc). Use the Discord tools to fulfill user requests for server management when explicitly asked.`;'
);

fs.writeFileSync('services/ai.js', c);
console.log('patched');
