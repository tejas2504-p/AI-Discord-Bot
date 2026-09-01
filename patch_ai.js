const fs = require('fs');

const file = 'services/ai.js';
let content = fs.readFileSync(file, 'utf8');

if (!content.includes('discordActions')) {
    content = content.replace(
        "const searchService = require('./search');",
        "const searchService = require('./search');\nconst discordActions = require('./discordActions');"
    );
}

const geminiTools = `
                {
                    name: 'send_message',
                    description: "Sends a text message to a specific Discord channel. Needs channelId.",
                    parameters: { type: 'OBJECT', properties: { channelId: { type: 'STRING' }, message: { type: 'STRING' } }, required: ['channelId', 'message'] }
                },
                {
                    name: 'create_channel',
                    description: "Creates a new Discord channel. type can be 'text' or 'voice'.",
                    parameters: { type: 'OBJECT', properties: { name: { type: 'STRING' }, type: { type: 'STRING' } }, required: ['name', 'type'] }
                },
                {
                    name: 'edit_message',
                    description: "Edits an existing Discord message.",
                    parameters: { type: 'OBJECT', properties: { messageId: { type: 'STRING' }, content: { type: 'STRING' } }, required: ['messageId', 'content'] }
                },
                {
                    name: 'delete_message',
                    description: "Deletes a Discord message.",
                    parameters: { type: 'OBJECT', properties: { messageId: { type: 'STRING' } }, required: ['messageId'] }
                },
                {
                    name: 'add_reaction',
                    description: "Adds an emoji reaction to a message.",
                    parameters: { type: 'OBJECT', properties: { messageId: { type: 'STRING' }, emoji: { type: 'STRING' } }, required: ['messageId', 'emoji'] }
                },
                {
                    name: 'assign_role',
                    description: "Assigns a role to a server member.",
                    parameters: { type: 'OBJECT', properties: { userId: { type: 'STRING' }, roleId: { type: 'STRING' } }, required: ['userId', 'roleId'] }
                },
                {
                    name: 'remove_role',
                    description: "Removes a role from a server member.",
                    parameters: { type: 'OBJECT', properties: { userId: { type: 'STRING' }, roleId: { type: 'STRING' } }, required: ['userId', 'roleId'] }
                },
                {
                    name: 'get_server_info',
                    description: "Gets information about the current Discord server.",
                    parameters: { type: 'OBJECT', properties: {} }
                },
                {
                    name: 'get_member_info',
                    description: "Gets information about a specific server member.",
                    parameters: { type: 'OBJECT', properties: { userId: { type: 'STRING' } }, required: ['userId'] }
                },`;

const groqTools = `
                                { type: 'function', function: { name: 'send_message', description: "Sends a text message to a specific Discord channel.", parameters: { type: 'object', properties: { channelId: { type: 'string' }, message: { type: 'string' } }, required: ['channelId', 'message'] } } },
                                { type: 'function', function: { name: 'create_channel', description: "Creates a new Discord channel.", parameters: { type: 'object', properties: { name: { type: 'string' }, type: { type: 'string' } }, required: ['name', 'type'] } } },
                                { type: 'function', function: { name: 'edit_message', description: "Edits an existing Discord message.", parameters: { type: 'object', properties: { messageId: { type: 'string' }, content: { type: 'string' } }, required: ['messageId', 'content'] } } },
                                { type: 'function', function: { name: 'delete_message', description: "Deletes a Discord message.", parameters: { type: 'object', properties: { messageId: { type: 'string' } }, required: ['messageId'] } } },
                                { type: 'function', function: { name: 'add_reaction', description: "Adds an emoji reaction to a message.", parameters: { type: 'object', properties: { messageId: { type: 'string' }, emoji: { type: 'string' } }, required: ['messageId', 'emoji'] } } },
                                { type: 'function', function: { name: 'assign_role', description: "Assigns a role to a server member.", parameters: { type: 'object', properties: { userId: { type: 'string' }, roleId: { type: 'string' } }, required: ['userId', 'roleId'] } } },
                                { type: 'function', function: { name: 'remove_role', description: "Removes a role from a server member.", parameters: { type: 'object', properties: { userId: { type: 'string' }, roleId: { type: 'string' } }, required: ['userId', 'roleId'] } } },
                                { type: 'function', function: { name: 'get_server_info', description: "Gets information about the current Discord server.", parameters: { type: 'object', properties: {} } } },
                                { type: 'function', function: { name: 'get_member_info', description: "Gets information about a specific server member.", parameters: { type: 'object', properties: { userId: { type: 'string' } }, required: ['userId'] } } },`;

// Inject Gemini Tools
if (!content.includes('send_message')) {
    content = content.replace(
        "name: 'delete_memory',\n                    description: \"Deletes a saved memory by key, or clears all user memories if the user requests you to forget everything.\",\n                    parameters: {\n                        type: 'OBJECT',\n                        properties: {\n                            key: {\n                                type: 'STRING',\n                                description: \"The key of the memory to delete (e.g. 'favorite_language'). Use 'everything' or '*all*' to wipe all memories for this user.\"\n                            }\n                        },\n                        required: ['key']\n                    }\n                }",
        "name: 'delete_memory',\n                    description: \"Deletes a saved memory by key, or clears all user memories if the user requests you to forget everything.\",\n                    parameters: {\n                        type: 'OBJECT',\n                        properties: {\n                            key: {\n                                type: 'STRING',\n                                description: \"The key of the memory to delete (e.g. 'favorite_language'). Use 'everything' or '*all*' to wipe all memories for this user.\"\n                            }\n                        },\n                        required: ['key']\n                    }\n                }," + geminiTools
    );

    // Inject Groq Tools
    content = content.replace(
        "{ type: 'function', function: { name: 'delete_memory', description: \"Deletes a memory.\", parameters: { type: 'object', properties: { key: { type: 'string' } }, required: ['key'] } } }",
        "{ type: 'function', function: { name: 'delete_memory', description: \"Deletes a memory.\", parameters: { type: 'object', properties: { key: { type: 'string' } }, required: ['key'] } } }," + groqTools
    );
}

const executionLogic = `
                } else if (['send_message', 'create_channel', 'edit_message', 'delete_message', 'add_reaction', 'assign_role', 'remove_role', 'get_server_info', 'get_member_info'].includes(CALL_NAME_VAR)) {
                    if (showAskLogs) console.log(\`[ASK 6] Executing Discord Tool: \${CALL_NAME_VAR}\`);
                    let result = { success: false, error: "Missing interaction object" };
                    if (options.interaction) {
                        if (CALL_NAME_VAR === 'send_message') result = await discordActions.send_message(options.interaction, CALL_ARGS_VAR.channelId, CALL_ARGS_VAR.message);
                        if (CALL_NAME_VAR === 'create_channel') result = await discordActions.create_channel(options.interaction, CALL_ARGS_VAR.name, CALL_ARGS_VAR.type);
                        if (CALL_NAME_VAR === 'edit_message') result = await discordActions.edit_message(options.interaction, CALL_ARGS_VAR.messageId, CALL_ARGS_VAR.content);
                        if (CALL_NAME_VAR === 'delete_message') result = await discordActions.delete_message(options.interaction, CALL_ARGS_VAR.messageId);
                        if (CALL_NAME_VAR === 'add_reaction') result = await discordActions.add_reaction(options.interaction, CALL_ARGS_VAR.messageId, CALL_ARGS_VAR.emoji);
                        if (CALL_NAME_VAR === 'assign_role') result = await discordActions.assign_role(options.interaction, CALL_ARGS_VAR.userId, CALL_ARGS_VAR.roleId);
                        if (CALL_NAME_VAR === 'remove_role') result = await discordActions.remove_role(options.interaction, CALL_ARGS_VAR.userId, CALL_ARGS_VAR.roleId);
                        if (CALL_NAME_VAR === 'get_server_info') result = await discordActions.get_server_info(options.interaction);
                        if (CALL_NAME_VAR === 'get_member_info') result = await discordActions.get_member_info(options.interaction, CALL_ARGS_VAR.userId);
                    }
                    if (showAskLogs) console.log(\`[ASK 7] Tool completed\`);
`;

// Inject execution logic for Gemini
if (!content.includes('Executing Discord Tool')) {
    const geminiLogic = executionLogic.replace(/CALL_NAME_VAR/g, 'call.name').replace(/CALL_ARGS_VAR/g, 'call.args') + `
                    contents.push({
                        role: 'model',
                        parts: [{ functionCall: { name: call.name, args: call.args } }]
                    });
                    contents.push({
                        role: 'function',
                        parts: [{ functionResponse: { name: call.name, response: result } }]
                    });
                    continue;
`;
    content = content.replace(
        "} else if (call.name === 'delete_memory') {",
        "} else if (call.name === 'delete_memory') {\n" // Hacky way: We can just replace the end of delete_memory execution
    );
    // Actually better to replace the 'continue;' of delete_memory
    const deleteMemTargetGemini = `                    contents.push({
                        role: 'function',
                        parts: [{ functionResponse: { name: 'delete_memory', response: { success: result } } }]
                    });
                    continue;`;
    content = content.replace(deleteMemTargetGemini, deleteMemTargetGemini + geminiLogic);

    // Inject execution logic for Groq
    const groqLogic = executionLogic.replace(/CALL_NAME_VAR/g, 'callName').replace(/CALL_ARGS_VAR/g, 'callArgs') + `
                    messages.push({
                        role: 'assistant',
                        tool_calls: [{
                            id: toolCall.id,
                            type: 'function',
                            function: {
                                name: callName,
                                arguments: JSON.stringify(callArgs)
                            }
                        }]
                    });
                    messages.push({
                        role: 'tool',
                        tool_call_id: toolCall.id,
                        name: callName,
                        content: JSON.stringify(result)
                    });
`;
    const deleteMemTargetGroq = `                    messages.push({
                        role: 'tool',
                        tool_call_id: toolCall.id,
                        name: callName,
                        content: JSON.stringify({ success: result })
                    });`;
    content = content.replace(deleteMemTargetGroq, deleteMemTargetGroq + groqLogic);
}

fs.writeFileSync(file, content, 'utf8');
console.log('Patched ai.js successfully');
