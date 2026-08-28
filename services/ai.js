require('dotenv').config();
const searchService = require('./search');
const timeService = require('./time');
const memoryService = require('./memory');

/**
 * Service to interact with the Gemini AI model.
 * Uses native fetch to avoid external dependencies.
 */
class AIService {
    constructor() {
        this.apiKey = process.env.GEMINI_API_KEY;
        this.model = 'gemini-2.5-flash';
    }

    /**
     * Generate content from a text prompt.
     * @param {string} prompt The prompt to send to the AI
     * @param {Array} history Optional conversation history
     * @returns {Promise<string>} The response text from the AI
     */
    /**
     * Helper to call Google Gemini generateContent REST API.
     */
    async executeGenerateContent(contents, tools) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;
        let systemInstructionText = `You are an AI assistant operating inside Discord.`;
        if (tools) {
            systemInstructionText += `\nYou have access to external tools that provide current information and manage long-term user memories.
You must use the appropriate tool whenever the user's request requires information that may be current, real-time, recent, or time-sensitive.
Never guess current information from your internal knowledge when an appropriate tool is available.

TOOL SELECTION LOGIC:
- IF the user asks for information involving the current date or time (e.g. today's date, current day, current time, current year, today's date/time in India/Asia/Kolkata):
  * Use getCurrentDateTime()
  * Treat the tool result as the authoritative current date/time. Do not manually calculate, estimate, or hardcode today's date.
- ELSE IF the user asks for information that may have changed recently or requires live web information (e.g. latest news, technology versions, company/product details, current prices, market details, recent releases, statistics, or information that may have changed since the model's knowledge was created):
  * Use webSearch(query)
  * Trust the web search results over outdated internal knowledge. Synthesize the returned content and preserve source URLs.
- ELSE (for stable/general questions that do not require current information like "What is Java?", "Explain OOP", "What is inheritance?", "What is MongoDB?"):
  * Do not call any tool; answer directly using your internal knowledge.

If a question requires BOTH current date/time and web information (e.g. "What is the current date and latest AI news?"), use both tools when necessary.

LONG-TERM MEMORY INSTRUCTIONS:
You have access to a persistent, user-isolated long-term memory store.
- If the user explicitly shares details about themselves, their preferences, project description, goals, or tells you to remember something (e.g. "I prefer Python now", "My favorite language is Java", "Remember that my project is a Discord AI Agent"):
  * Call save_memory(key, value, category, importance) or update_memory(key, value) if a memory on this topic already exists. Choose a clean lowercase key identifier.
  * Do NOT save ordinary conversational questions (e.g. "What is Java?", "Explain OOP").
- If the user asks you to "forget" something, or clear their data (e.g. "Forget my favorite language", "Forget everything you know about me"):
  * Call delete_memory(key). Use "everything" or "*all*" as the key to wipe all records for the user.
- If the user references their past preferences, projects, goals, or asks you "what do you know about me?", or if you need past user context to answer a query:
  * Autonomously call search_memory(query) first to retrieve relevant memories.

CONVERSATIONAL BEHAVIOR:
- Tool calls happen internally. Do not output any technical implementation details (such as "I am calling getCurrentDateTime" or "Executing webSearch") to the user. Simply provide the final natural language answer once the tool results are received.
- Do not claim to have searched the web if the webSearch tool was not actually executed.
- If a tool fails, do not fabricate results. Explain to the user that current information could not be retrieved. Do not expose internal details, API keys, or stack traces.`;
        } else {
            systemInstructionText += `\nProvide helpful, natural, and accurate responses directly using your knowledge base. Tool usage is currently disabled for this interaction.`;
        }

        const requestBody = { 
            contents,
            systemInstruction: {
                parts: [{
                    text: systemInstructionText
                }]
            }
        };
        if (tools) {
            requestBody.tools = tools;
        }

        let attempts = 0;
        const maxAttempts = 3;
        let backoffMs = 1000;
        let rateLimitAttempts = 0;
        const maxRateLimitAttempts = 1; // Only retry 429 once to avoid infinite loops

        while (attempts < maxAttempts) {
            attempts++;
            try {
                const response = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(requestBody),
                    signal: AbortSignal.timeout(15000) // 15 second timeout
                });

                // If Service Unavailable (503), retry with exponential backoff
                if (response.status === 503 && attempts < maxAttempts) {
                    console.warn(`Gemini API returned 503. Retrying attempt ${attempts} in ${backoffMs}ms...`);
                    await new Promise(resolve => setTimeout(resolve, backoffMs));
                    backoffMs *= 2;
                    continue;
                }

                if (!response.ok) {
                    const errData = await response.json().catch(() => ({}));
                    console.error('Gemini API error status:', response.status, errData);
                    
                    if (response.status === 429) {
                        if (rateLimitAttempts >= maxRateLimitAttempts) {
                            throw new Error("Gemini API rate limit exceeded. Please wait a moment before trying again.");
                        }
                        rateLimitAttempts++;
                        let waitMs = 30000; // Default 30s
                        const message = errData && errData.error && errData.error.message;
                        if (message) {
                            const match = message.match(/retry in ([\d\.]+)s/i);
                            if (match && match[1]) {
                                waitMs = Math.ceil(parseFloat(match[1]) * 1000) + 1000;
                            }
                        }
                        console.warn(`[Gemini] API returned 429. Automatically waiting ${waitMs}ms before retrying...`);
                        await new Promise(resolve => setTimeout(resolve, waitMs));
                        attempts--; // Do not count 429 wait towards attempts
                        continue;
                    } else if (response.status === 503) {
                        throw new Error("The AI service is temporarily overloaded or unavailable (503). Please try again shortly.");
                    } else {
                        throw new Error(`Error from Gemini API: Status ${response.status}. Please check your API key and connection.`);
                    }
                }

                const data = await response.json();
                
                if (data && data.candidates && data.candidates[0] && data.candidates[0].content) {
                    return data.candidates[0].content;
                }

                throw new Error("Received an empty or unexpected response format from the AI service.");
            } catch (error) {
                // If it is our custom error or we reached max attempts, throw it
                if (attempts >= maxAttempts || error.message.includes("Rate limit") || error.message.includes("temporarily overloaded")) {
                    console.error('AIService executeGenerateContent Error:', error);
                    throw error;
                }
                
                // For connection-level network errors, retry
                console.warn(`Network error on attempt ${attempts}. Retrying in ${backoffMs}ms...`, error);
                await new Promise(resolve => setTimeout(resolve, backoffMs));
                backoffMs *= 2;
            }
        }
    }

    /**
     * Generate content from a text prompt.
     * @param {string} prompt The prompt to send to the AI
     * @param {Array} history Optional conversation history
     * @returns {Promise<string>} The response text from the AI
     */
    async generateContent(prompt, history = [], options = {}) {
        if (process.env.GROQ_API_KEY && process.env.GROQ_API_KEY.trim() !== '' && process.env.GROQ_API_KEY !== 'your_groq_api_key_here') {
            return this.generateContentGroq(prompt, history, options);
        }

        if (!this.apiKey || this.apiKey === 'your_gemini_api_key_here') {
            throw new Error("AI feature is not configured. Please add a valid `GEMINI_API_KEY` to your `.env` file.");
        }

        console.log(`[Gemini] Processing request`);

        const contents = [];
        
        // Add existing conversation history if provided
        if (history && history.length > 0) {
            contents.push(...history.map(h => ({
                role: h.role,
                parts: h.parts.map(p => {
                    if (p.text) return { text: p.text };
                    if (p.functionCall) return { functionCall: p.functionCall };
                    if (p.functionResponse) return { functionResponse: p.functionResponse };
                    return { text: '' };
                })
            })));
        }

        // Add the new user prompt
        contents.push({
            role: 'user',
            parts: [{ text: prompt }]
        });

        const tools = options.disableTools ? null : [{
            functionDeclarations: [
                {
                    name: 'webSearch',
                    description: "Searches the live web for current information. Use this tool when the user asks for recent, latest, current, real-time, news, or explicitly web-based information.",
                    parameters: {
                        type: 'OBJECT',
                        properties: {
                            query: {
                                type: 'STRING',
                                description: "The search query string to run on the web."
                            }
                        },
                        required: ['query']
                    }
                },
                {
                    name: 'getCurrentDateTime',
                    description: "Returns the current date and time using the server clock. Use this tool whenever the user asks for today's date, current date, current time, current day, current year, or other real-time date and time information.",
                    parameters: {
                        type: 'OBJECT',
                        properties: {}
                    }
                },
                {
                    name: 'save_memory',
                    description: "Saves a useful long-term memory, preference, project description, goal, or instruction about the current user. Do NOT save ordinary conversational banter or temp question contexts. Only call this when the user explicitly shares details about themselves, their preferences, or commands you to remember something.",
                    parameters: {
                        type: 'OBJECT',
                        properties: {
                            key: {
                                type: 'STRING',
                                description: "The short unique lowercase key identifier for the memory (e.g. 'favorite_language', 'project_name', 'theme_preference')."
                            },
                            value: {
                                type: 'STRING',
                                description: "The actual facts/information/preference text to store."
                            },
                            category: {
                                type: 'STRING',
                                description: "The category classification for this memory.",
                                enum: ['preference', 'profile', 'project', 'goal', 'instruction', 'context', 'other']
                            },
                            importance: {
                                type: 'INTEGER',
                                description: "The scale of importance from 1 (lowest) to 10 (highest). Default is 5."
                            }
                        },
                        required: ['key', 'value']
                    }
                },
                {
                    name: 'search_memory',
                    description: "Searches the user's stored long-term memories using a query term. Use this autonomously when the user references their past preferences, projects, goals, or asks you what you know about them.",
                    parameters: {
                        type: 'OBJECT',
                        properties: {
                            query: {
                                type: 'STRING',
                                description: "The search query (keywords) to query the user's memory database."
                            }
                        },
                        required: ['query']
                    }
                },
                {
                    name: 'update_memory',
                    description: "Updates an existing saved memory value for the user when their preferences or details change. Do not create a duplicate key if a memory on the topic already exists.",
                    parameters: {
                        type: 'OBJECT',
                        properties: {
                            key: {
                                type: 'STRING',
                                description: "The key of the memory to update."
                            },
                            value: {
                                type: 'STRING',
                                description: "The new value to associate with the key."
                            }
                        },
                        required: ['key', 'value']
                    }
                },
                {
                    name: 'delete_memory',
                    description: "Deletes a saved memory by key, or clears all user memories if the user requests you to forget everything.",
                    parameters: {
                        type: 'OBJECT',
                        properties: {
                            key: {
                                type: 'STRING',
                                description: "The key of the memory to delete (e.g. 'favorite_language'). Use 'everything' or '*all*' to wipe all memories for this user."
                            }
                        },
                        required: ['key']
                    }
                }
            ]
        }];

        let loopCount = 0;
        const maxLoops = 3; // Max 3 tool calls

        while (loopCount < maxLoops) {
            loopCount++;
            
            // Log only for the user /ask tool-calling flow (not classification/formatting)
            const showAskLogs = !options.disableTools;
            
            if (showAskLogs) {
                if (loopCount === 1) {
                    console.log('[ASK 3] Sending request to Gemini');
                } else {
                    console.log('[ASK 8] Sending tool result back to Gemini');
                }
            } else {
                console.log(`[Gemini] Processing request (Attempt ${loopCount})`);
            }
            
            const startGeminiCall = Date.now();
            const content = await this.executeGenerateContent(contents, tools);
            const durationGeminiCall = ((Date.now() - startGeminiCall) / 1000).toFixed(2);
            
            if (showAskLogs) {
                console.log(`[ASK 4] Gemini response received (took ${durationGeminiCall}s)`);
            } else {
                console.log(`[Gemini] Response received (took ${durationGeminiCall}s)`);
            }
            
            if (!content.parts || content.parts.length === 0) {
                throw new Error("Received empty parts from Gemini API.");
            }

            const part = content.parts[0];

            // If Gemini decides to call a tool
            if (part.functionCall) {
                const call = part.functionCall;
                if (showAskLogs) {
                    console.log(`[ASK 5] Tool requested: ${call.name}`);
                }
                
                // Explicit routing: only execute getCurrentDateTime and webSearch
                if (call.name === 'webSearch') {
                    
                    // Validate query argument
                    let query = call.args && call.args.query;
                    let searchResults;
                    
                    if (!query || typeof query !== 'string' || query.trim() === '') {
                        console.error(`[WebSearch] Error: Invalid or missing query argument`);
                        searchResults = [{ error: "Invalid or missing 'query' argument." }];
                    } else {
                        if (showAskLogs) {
                            console.log(`[ASK 6] Executing tool`);
                        }
                        try {
                            searchResults = await searchService.search(query);
                            if (showAskLogs) {
                                console.log(`[ASK 7] Tool completed`);
                            }
                        } catch (err) {
                            console.error(`[WebSearch] Error:`, err.message);
                            searchResults = [{ error: `Search failed: ${err.message}` }];
                            if (showAskLogs) {
                                console.log(`[ASK 7] Tool completed`);
                            }
                        }
                    }

                    // 1. Add model's turn requesting the function call
                    contents.push({
                        role: 'model',
                        parts: [
                            {
                                functionCall: {
                                    name: 'webSearch',
                                    args: { query: query || "" }
                                }
                            }
                        ]
                    });

                    // 2. Add function execution result
                    contents.push({
                        role: 'function',
                        parts: [
                            {
                                functionResponse: {
                                    name: 'webSearch',
                                    response: {
                                        content: searchResults
                                    }
                                }
                            }
                        ]
                    });

                    // Re-run loop to send function response back to Gemini
                    continue;
                } else if (call.name === 'getCurrentDateTime') {
                    if (showAskLogs) {
                        console.log(`[ASK 6] Executing tool`);
                    }
                    
                    let timeResult;
                    try {
                        timeResult = timeService.getCurrentDateTime();
                        if (showAskLogs) {
                            console.log(`[ASK 7] Tool completed`);
                        }
                    } catch (err) {
                        console.error(`[Tool] Error:`, err.message);
                        timeResult = { error: `Time retrieval failed: ${err.message}` };
                        if (showAskLogs) {
                            console.log(`[ASK 7] Tool completed`);
                        }
                    }

                    // 1. Add model's turn requesting the function call
                    contents.push({
                        role: 'model',
                        parts: [
                            {
                                functionCall: {
                                    name: 'getCurrentDateTime',
                                    args: {}
                                }
                            }
                        ]
                    });

                    // 2. Add function execution result
                    contents.push({
                        role: 'function',
                        parts: [
                            {
                                functionResponse: {
                                    name: 'getCurrentDateTime',
                                    response: timeResult
                                }
                            }
                        ]
                    });

                    // Re-run loop to send function response back to Gemini
                    continue;
                } else if (call.name === 'save_memory') {
                    const key = call.args && call.args.key;
                    const value = call.args && call.args.value;
                    const category = (call.args && call.args.category) || 'other';
                    const importance = (call.args && call.args.importance) || 5;

                    if (showAskLogs) console.log(`[ASK 6] Executing tool`);
                    const result = await memoryService.saveMemory(options.userId, options.guildId, key, value, category, importance);
                    if (showAskLogs) console.log(`[ASK 7] Tool completed`);

                    contents.push({
                        role: 'model',
                        parts: [{ functionCall: { name: 'save_memory', args: { key, value, category, importance } } }]
                    });
                    contents.push({
                        role: 'function',
                        parts: [{ functionResponse: { name: 'save_memory', response: result ? { success: true } : { success: false, error: "Failed to save memory" } } }]
                    });
                    continue;
                } else if (call.name === 'search_memory') {
                    const query = call.args && call.args.query;
                    if (showAskLogs) console.log(`[ASK 6] Executing tool`);
                    const memories = await memoryService.searchMemories(options.userId, options.guildId, query);
                    if (showAskLogs) console.log(`[ASK 7] Tool completed`);

                    contents.push({
                        role: 'model',
                        parts: [{ functionCall: { name: 'search_memory', args: { query } } }]
                    });
                    contents.push({
                        role: 'function',
                        parts: [{ functionResponse: { name: 'search_memory', response: { results: memories } } }]
                    });
                    continue;
                } else if (call.name === 'update_memory') {
                    const key = call.args && call.args.key;
                    const value = call.args && call.args.value;

                    if (showAskLogs) console.log(`[ASK 6] Executing tool`);
                    const result = await memoryService.updateMemory(options.userId, options.guildId, key, value);
                    if (showAskLogs) console.log(`[ASK 7] Tool completed`);

                    contents.push({
                        role: 'model',
                        parts: [{ functionCall: { name: 'update_memory', args: { key, value } } }]
                    });
                    contents.push({
                        role: 'function',
                        parts: [{ functionResponse: { name: 'update_memory', response: result ? { success: true } : { success: false, error: "Failed to update memory" } } }]
                    });
                    continue;
                } else if (call.name === 'delete_memory') {
                    const key = call.args && call.args.key;

                    if (showAskLogs) console.log(`[ASK 6] Executing tool`);
                    const result = await memoryService.deleteMemory(options.userId, options.guildId, key);
                    if (showAskLogs) console.log(`[ASK 7] Tool completed`);

                    contents.push({
                        role: 'model',
                        parts: [{ functionCall: { name: 'delete_memory', args: { key } } }]
                    });
                    contents.push({
                        role: 'function',
                        parts: [{ functionResponse: { name: 'delete_memory', response: { success: result } } }]
                    });
                    continue;
                } else {
                    // Safe explicit routing block for arbitrary function calls
                    console.warn(`[Gemini] Blocked arbitrary tool call attempt: ${call.name}`);
                    
                    contents.push({
                        role: 'model',
                        parts: [{ functionCall: call }]
                    });
                    
                    contents.push({
                        role: 'function',
                        parts: [{
                            functionResponse: {
                                name: call.name,
                                response: { error: `Unsupported tool name: ${call.name}` }
                            }
                        }]
                    });
                    
                    continue;
                }
            }

            // If it returns text content
            if (part.text) {
                if (showAskLogs) {
                    console.log(`[ASK 9] Final Gemini response received`);
                } else {
                    console.log(`[Gemini] Generating final response`);
                }
                return part.text;
            }

            throw new Error("Received an unexpected content response structure (neither text nor functionCall).");
        }

        console.warn("[Gemini] Tool loop limit exceeded.");
        return "I'm sorry, I could not complete your request within the maximum number of steps. Please try simplifying your question.";
    }

    /**
     * Generate content from a text prompt using Groq.
     */
    async generateContentGroq(prompt, history = [], options = {}) {
        console.log(`[Groq] Processing request`);

        let systemInstruction = `You are an AI assistant operating inside Discord.`;
        if (!options.disableTools) {
            systemInstruction += `\nYou have access to external tools that provide current information and manage long-term user memories.
You must use the appropriate tool whenever the user's request requires information that may be current, real-time, recent, or time-sensitive.
Never guess current information from your internal knowledge when an appropriate tool is available.

TOOL SELECTION LOGIC:
- IF the user asks for information involving the current date or time (e.g. today's date, current day, current time, current year, today's date/time in India/Asia/Kolkata):
  * Use getCurrentDateTime()
  * Treat the tool result as the authoritative current date/time. Do not manually calculate, estimate, or hardcode today's date.
- ELSE IF the user asks for information that may have changed recently or requires live web information (e.g. latest news, technology versions, company/product details, current prices, market details, recent releases, statistics, or information that may have changed since the model's knowledge was created):
  * Use webSearch(query)
  * Trust the web search results over outdated internal knowledge. Synthesize the returned content and preserve source URLs.
- ELSE (for stable/general questions do not require current information like "What is Java?", "Explain OOP", "What is inheritance?", "What is MongoDB?"):
  * Do not call any tool; answer directly using your internal knowledge.

If a question requires BOTH current date/time and web information (e.g. "What is the current date and latest AI news?"), use both tools when necessary.

LONG-TERM MEMORY INSTRUCTIONS:
You have access to a persistent, user-isolated long-term memory store.
- If the user explicitly shares details about themselves, their preferences, project description, goals, or tells you to remember something (e.g. "I prefer Python now", "My favorite language is Java", "Remember that my project is a Discord AI Agent"):
  * Call save_memory(key, value, category, importance) or update_memory(key, value) if a memory on this topic already exists. Choose a clean lowercase key identifier.
  * Do NOT save ordinary conversational questions (e.g. "What is Java?", "Explain OOP").
- If the user asks you to "forget" something, or clear their data (e.g. "Forget my favorite language", "Forget everything you know about me"):
  * Call delete_memory(key). Use "everything" or "*all*" as the key to wipe all records for the user.
- If the user references their past preferences, projects, goals, or asks you "what do you know about me?", or if you need past user context to answer a query:
  * Autonomously call search_memory(query) first to retrieve relevant memories.

CONVERSATIONAL BEHAVIOR:
- Tool calls happen internally. Do not output any technical implementation details (such as "I am calling getCurrentDateTime" or "Executing webSearch") to the user. Simply provide the final natural language answer once the tool results are received.
- Do not claim to have searched the web if the webSearch tool was not actually executed.
- If a tool fails, do not fabricate results. Explain to the user that current information could not be retrieved. Do not expose internal details, API keys, or stack traces.`;
        } else {
            systemInstruction += `\nProvide helpful, natural, and accurate responses directly using your knowledge base. Tool usage is currently disabled for this interaction.`;
        }

        const messages = [
            { role: 'system', content: systemInstruction }
        ];

        // Add history
        if (history && history.length > 0) {
            for (const h of history) {
                const role = h.role === 'model' ? 'assistant' : (h.role === 'function' ? 'tool' : 'user');
                for (const part of h.parts) {
                    if (part.text) {
                        messages.push({ role, content: part.text });
                    } else if (part.functionCall) {
                        messages.push({
                            role: 'assistant',
                            tool_calls: [{
                                id: part.functionCall.id || `call_${Math.random().toString(36).substring(2, 11)}`,
                                type: 'function',
                                function: {
                                    name: part.functionCall.name,
                                    arguments: JSON.stringify(part.functionCall.args || {})
                                }
                            }]
                        });
                    } else if (part.functionResponse) {
                        messages.push({
                            role: 'tool',
                            tool_call_id: part.functionResponse.id || `call_${Math.random().toString(36).substring(2, 11)}`,
                            name: part.functionResponse.name,
                            content: typeof part.functionResponse.response === 'string' ? part.functionResponse.response : JSON.stringify(part.functionResponse.response)
                        });
                    }
                }
            }
        }

        // Add user prompt
        messages.push({ role: 'user', content: prompt });

        let loopCount = 0;
        const maxLoops = 3;
        const showAskLogs = !options.disableTools;

        while (loopCount < maxLoops) {
            loopCount++;

            if (showAskLogs) {
                if (loopCount === 1) {
                    console.log('[ASK 3] Sending request to Gemini');
                } else {
                    console.log('[ASK 8] Sending tool result back to Gemini');
                }
            } else {
                console.log(`[Groq] Processing request (Attempt ${loopCount})`);
            }

            const startCall = Date.now();
            const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
                },
                body: JSON.stringify({
                    model: 'openai/gpt-oss-20b',
                    messages,
                    tools: options.disableTools ? undefined : [
                        {
                            type: 'function',
                            function: {
                                name: 'webSearch',
                                description: "Searches the live web for current information. Use this tool when the user asks for recent, latest, current, real-time, news, or explicitly web-based information.",
                                parameters: {
                                    type: 'object',
                                    properties: {
                                        query: {
                                            type: 'string',
                                            description: "The search query string to run on the web."
                                        }
                                    },
                                    required: ['query']
                                }
                            }
                        },
                        {
                            type: 'function',
                            function: {
                                name: 'getCurrentDateTime',
                                description: "Returns the current date and time using the server clock. Use this tool whenever the user asks for today's date, current date, current time, current day, current year, or other real-time date and time information.",
                                parameters: {
                                    type: 'object',
                                    properties: {}
                                }
                            }
                        },
                        {
                            type: 'function',
                            function: {
                                name: 'save_memory',
                                description: "Saves a useful long-term memory, preference, project description, goal, or instruction about the current user. Only call this when the user explicitly shares details about themselves, their preferences, or commands you to remember something.",
                                parameters: {
                                    type: 'object',
                                    properties: {
                                        key: {
                                            type: 'string',
                                            description: "The short unique lowercase key identifier for the memory (e.g. 'favorite_language', 'project_name')."
                                        },
                                        value: {
                                            type: 'string',
                                            description: "The actual facts/information/preference text to store."
                                        },
                                        category: {
                                            type: 'string',
                                            description: "The category classification for this memory.",
                                            enum: ['preference', 'profile', 'project', 'goal', 'instruction', 'context', 'other']
                                        },
                                        importance: {
                                            type: 'integer',
                                            description: "Importance scale from 1 to 10. Default is 5."
                                        }
                                    },
                                    required: ['key', 'value']
                                }
                            }
                        },
                        {
                            type: 'function',
                            function: {
                                name: 'search_memory',
                                description: "Searches the user's stored long-term memories using a query term. Use this autonomously when the user references their past preferences, projects, goals, or asks you what you know about them.",
                                parameters: {
                                    type: 'object',
                                    properties: {
                                        query: {
                                            type: 'string',
                                            description: "The search query keywords."
                                        }
                                    },
                                    required: ['query']
                                }
                            }
                        },
                        {
                            type: 'function',
                            function: {
                                name: 'update_memory',
                                description: "Updates an existing saved memory value for the user when their preferences or details change. Do not create a duplicate key.",
                                parameters: {
                                    type: 'object',
                                    properties: {
                                        key: {
                                            type: 'string',
                                            description: "The key of the memory to update."
                                        },
                                        value: {
                                            type: 'string',
                                            description: "The new value."
                                        }
                                    },
                                    required: ['key', 'value']
                                }
                            }
                        },
                        {
                            type: 'function',
                            function: {
                                name: 'delete_memory',
                                description: "Deletes a saved memory by key, or clears all user memories if the user requests you to forget everything.",
                                parameters: {
                                    type: 'object',
                                    properties: {
                                        key: {
                                            type: 'string',
                                            description: "The key of the memory to delete. Use 'everything' or 'all' to wipe all memories."
                                        }
                                    },
                                    required: ['key']
                                }
                            }
                        }
                    ],
                    tool_choice: options.disableTools ? undefined : 'auto'
                }),
                signal: AbortSignal.timeout(15000)
            });

            if (!res.ok) {
                const errText = await res.text();
                throw new Error(`Groq API error Status ${res.status}: ${errText}`);
            }

            const data = await res.json();
            const message = data.choices[0].message;
            const duration = ((Date.now() - startCall) / 1000).toFixed(2);

            if (showAskLogs) {
                console.log(`[ASK 4] Gemini response received (took ${duration}s)`);
            } else {
                console.log(`[Groq] Response received (took ${duration}s)`);
            }

            // If Groq decides to call a tool
            if (message.tool_calls && message.tool_calls.length > 0) {
                const toolCall = message.tool_calls[0];
                const callName = toolCall.function.name;
                const callArgs = JSON.parse(toolCall.function.arguments || '{}');

                if (showAskLogs) {
                    console.log(`[ASK 5] Tool requested: ${callName}`);
                }

                // Add assistant message requesting tool calls
                messages.push(message);

                let result;
                if (callName === 'webSearch') {
                    const query = callArgs.query;
                    if (!query || typeof query !== 'string' || query.trim() === '') {
                        result = { error: "Invalid or missing 'query' argument." };
                    } else {
                        if (showAskLogs) console.log(`[ASK 6] Executing tool`);
                        try {
                            result = await searchService.search(query);
                            if (showAskLogs) console.log(`[ASK 7] Tool completed`);
                        } catch (err) {
                            console.error(`[WebSearch] Error:`, err.message);
                            result = { error: `Search failed: ${err.message}` };
                            if (showAskLogs) console.log(`[ASK 7] Tool completed`);
                        }
                    }
                } else if (callName === 'getCurrentDateTime') {
                    if (showAskLogs) console.log(`[ASK 6] Executing tool`);
                    try {
                        result = timeService.getCurrentDateTime();
                        if (showAskLogs) console.log(`[ASK 7] Tool completed`);
                    } catch (err) {
                        console.error(`[Tool] Error:`, err.message);
                        result = { error: `Time retrieval failed: ${err.message}` };
                        if (showAskLogs) console.log(`[ASK 7] Tool completed`);
                    }
                } else if (callName === 'save_memory') {
                    const key = callArgs.key;
                    const value = callArgs.value;
                    const category = callArgs.category || 'other';
                    const importance = callArgs.importance || 5;

                    if (showAskLogs) console.log(`[ASK 6] Executing tool`);
                    const res = await memoryService.saveMemory(options.userId, options.guildId, key, value, category, importance);
                    if (showAskLogs) console.log(`[ASK 7] Tool completed`);
                    result = res ? { success: true } : { success: false, error: "Failed to save memory" };
                } else if (callName === 'search_memory') {
                    const query = callArgs.query;
                    if (showAskLogs) console.log(`[ASK 6] Executing tool`);
                    const memories = await memoryService.searchMemories(options.userId, options.guildId, query);
                    if (showAskLogs) console.log(`[ASK 7] Tool completed`);
                    result = { results: memories };
                } else if (callName === 'update_memory') {
                    const key = callArgs.key;
                    const value = callArgs.value;

                    if (showAskLogs) console.log(`[ASK 6] Executing tool`);
                    const res = await memoryService.updateMemory(options.userId, options.guildId, key, value);
                    if (showAskLogs) console.log(`[ASK 7] Tool completed`);
                    result = res ? { success: true } : { success: false, error: "Failed to update memory" };
                } else if (callName === 'delete_memory') {
                    const key = callArgs.key;

                    if (showAskLogs) console.log(`[ASK 6] Executing tool`);
                    const res = await memoryService.deleteMemory(options.userId, options.guildId, key);
                    if (showAskLogs) console.log(`[ASK 7] Tool completed`);
                    result = { success: res };
                } else {
                    result = { error: `Unsupported tool name: ${callName}` };
                }

                // Add tool result to messages
                messages.push({
                    role: 'tool',
                    tool_call_id: toolCall.id,
                    name: callName,
                    content: JSON.stringify(result)
                });

                continue;
            }

            if (message.content) {
                if (showAskLogs) {
                    console.log(`[ASK 9] Final Gemini response received`);
                }
                return message.content;
            }
        }

        console.warn("[Groq] Tool loop limit exceeded.");
        return "I'm sorry, I could not complete your request within the maximum number of steps. Please try simplifying your question.";
    }

    /**
     * Generate an image from a text prompt using Imagen 3.
     * @param {string} prompt The description of the image to generate
     * @param {object} options Additional settings such as aspectRatio
     * @returns {Promise<Buffer>} The image data buffer
     */
    async generateImage(prompt, options = {}) {
        if (!this.apiKey || this.apiKey === 'your_gemini_api_key_here') {
            throw new Error("AI feature is not configured. Please add a valid `GEMINI_API_KEY` to your `.env` file.");
        }

        const model = 'imagen-4.0-generate-001';
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:predict?key=${this.apiKey}`;

        const payload = {
            instances: [
                { prompt: prompt }
            ],
            parameters: {
                sampleCount: 1,
                aspectRatio: options.aspectRatio || "1:1",
                outputMimeType: "image/png"
            }
        };

        let attempts = 0;
        const maxAttempts = 3;
        let backoffMs = 1000;

        while (attempts < maxAttempts) {
            attempts++;
            try {
                const response = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(payload),
                    signal: AbortSignal.timeout(15000) // 15 second timeout
                });

                // If Service Unavailable (503), retry with exponential backoff
                if (response.status === 503 && attempts < maxAttempts) {
                    console.warn(`Gemini API returned 503. Retrying attempt ${attempts} in ${backoffMs}ms...`);
                    await new Promise(resolve => setTimeout(resolve, backoffMs));
                    backoffMs *= 2;
                    continue;
                }

                if (!response.ok) {
                    const errData = await response.json().catch(() => ({}));
                    console.error('Gemini API image generation error status:', response.status, errData);
                    
                    if (errData.error && errData.error.message && errData.error.message.includes("paid plans")) {
                        throw new Error("Image generation is only available on paid plans in Google AI Studio. Please upgrade your Google AI Studio project to enable billing.");
                    }
                    
                    if (response.status === 429) {
                        throw new Error("Rate limit exceeded (Too Many Requests). Please wait a moment before trying again.");
                    } else if (response.status === 503) {
                        throw new Error("The AI service is temporarily overloaded or unavailable (503). Please try again shortly.");
                    } else {
                        throw new Error(`Error from Gemini API: Status ${response.status}. Please check your API key and connection.`);
                    }
                }

                const data = await response.json();
                
                if (
                    data &&
                    data.predictions &&
                    data.predictions[0] &&
                    data.predictions[0].bytesBase64Encoded
                ) {
                    return Buffer.from(data.predictions[0].bytesBase64Encoded, 'base64');
                }

                throw new Error("Received an empty or unexpected response format from the AI image generation service.");
            } catch (error) {
                // If it is our custom error or we reached max attempts, throw it
                if (attempts >= maxAttempts || error.message.includes("Rate limit") || error.message.includes("temporarily overloaded")) {
                    console.error('AIService generateImage Error:', error);
                    throw error;
                }
                
                // For connection-level network errors, retry
                console.warn(`Network error on attempt ${attempts}. Retrying in ${backoffMs}ms...`, error);
                await new Promise(resolve => setTimeout(resolve, backoffMs));
                backoffMs *= 2;
            }
        }
    }
}

module.exports = new AIService();
