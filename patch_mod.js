const fs = require('fs');

const file = 'services/ai.js';
let content = fs.readFileSync(file, 'utf8');

const geminiModTool = `
                {
                    name: 'moderate_message',
                    description: "Analyzes a message for toxicity/spam and returns a structured moderation assessment.",
                    parameters: { type: 'OBJECT', properties: { content: { type: 'STRING' } }, required: ['content'] }
                },`;
                
const groqModTool = `
                                { type: 'function', function: { name: 'moderate_message', description: "Analyzes a message for toxicity/spam.", parameters: { type: 'object', properties: { content: { type: 'string' } }, required: ['content'] } } },`;

if (!content.includes('moderate_message')) {
    // Gemini
    content = content.replace(
        "name: 'get_member_info',",
        "name: 'get_member_info',"
    ).replace(
        "},",
        "},"
    ); // Let's use string split and join instead to be safe

    content = content.replace(
        "name: 'get_member_info',\n                    description: \"Gets information about a specific server member.\",\n                    parameters: { type: 'OBJECT', properties: { userId: { type: 'STRING' } }, required: ['userId'] }\n                },",
        "name: 'get_member_info',\n                    description: \"Gets information about a specific server member.\",\n                    parameters: { type: 'OBJECT', properties: { userId: { type: 'STRING' } }, required: ['userId'] }\n                }," + geminiModTool
    );

    // Groq
    content = content.replace(
        "{ type: 'function', function: { name: 'get_member_info', description: \"Gets information about a specific server member.\", parameters: { type: 'object', properties: { userId: { type: 'string' } }, required: ['userId'] } } },",
        "{ type: 'function', function: { name: 'get_member_info', description: \"Gets information about a specific server member.\", parameters: { type: 'object', properties: { userId: { type: 'string' } }, required: ['userId'] } } }," + groqModTool
    );

    // Execution Logic
    content = content.replace(
        "if (CALL_NAME_VAR === 'get_member_info') result = await discordActions.get_member_info(options.interaction, CALL_ARGS_VAR.userId);",
        "if (CALL_NAME_VAR === 'get_member_info') result = await discordActions.get_member_info(options.interaction, CALL_ARGS_VAR.userId);\n                        if (CALL_NAME_VAR === 'moderate_message') { const mod = require('./moderation'); result = await mod.callAI(CALL_ARGS_VAR.content); }"
    );
    
    // Add to allowed list
    content = content.replace(
        "['send_message', 'create_channel', 'edit_message', 'delete_message', 'add_reaction', 'assign_role', 'remove_role', 'get_server_info', 'get_member_info']",
        "['send_message', 'create_channel', 'edit_message', 'delete_message', 'add_reaction', 'assign_role', 'remove_role', 'get_server_info', 'get_member_info', 'moderate_message']"
    );
    
    // Groq logic
    content = content.replace(
        "if (callName === 'get_member_info') result = await discordActions.get_member_info(options.interaction, callArgs.userId);",
        "if (callName === 'get_member_info') result = await discordActions.get_member_info(options.interaction, callArgs.userId);\n                        if (callName === 'moderate_message') { const mod = require('./moderation'); result = await mod.callAI(callArgs.content); }"
    );

    fs.writeFileSync(file, content, 'utf8');
    console.log('patched moderate_message into ai.js');
}
