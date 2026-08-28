require('dotenv').config();
const searchService = require('./search');
const timeService = require('./time');

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
        const requestBody = { 
            contents,
            systemInstruction: {
                parts: [{
                    text: `You are an AI assistant operating inside Discord.
You have access to external tools that provide current information.
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

CONVERSATIONAL BEHAVIOR:
- Tool calls happen internally. Do not output any technical implementation details (such as "I am calling getCurrentDateTime" or "Executing webSearch") to the user. Simply provide the final natural language answer once the tool results are received.
- Do not claim to have searched the web if the webSearch tool was not actually executed.
- If a tool fails, do not fabricate results. Explain to the user that current information could not be retrieved. Do not expose internal details, API keys, or stack traces.`
                }]
            }
        };
        if (tools) {
            requestBody.tools = tools;
        }

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
                }
            ]
        }];

        let loopCount = 0;
        const maxLoops = 5;

        while (loopCount < maxLoops) {
            loopCount++;
            const content = await this.executeGenerateContent(contents, tools);
            
            if (!content.parts || content.parts.length === 0) {
                throw new Error("Received empty parts from Gemini API.");
            }

            const part = content.parts[0];

            // If Gemini decides to call a tool
            if (part.functionCall) {
                const call = part.functionCall;
                
                // Explicit routing: only execute getCurrentDateTime and webSearch
                if (call.name === 'webSearch') {
                    console.log(`[ASK] Gemini requested tool: webSearch`);
                    
                    // Validate query argument
                    let query = call.args && call.args.query;
                    let searchResults;
                    
                    if (!query || typeof query !== 'string' || query.trim() === '') {
                        console.error(`[WebSearch] Error: Invalid or missing query argument`);
                        searchResults = [{ error: "Invalid or missing 'query' argument." }];
                    } else {
                        console.log(`[ASK] executing tool`);
                        try {
                            searchResults = await searchService.search(query);
                            console.log(`[ASK] tool completed`);
                        } catch (err) {
                            console.error(`[WebSearch] Error:`, err.message);
                            searchResults = [{ error: `Search failed: ${err.message}` }];
                        }
                    }

                    console.log(`[ASK] sending tool result to Gemini`);

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
                    console.log(`[ASK] Gemini requested tool: getCurrentDateTime`);
                    console.log(`[ASK] executing tool`);
                    
                    let timeResult;
                    try {
                        timeResult = timeService.getCurrentDateTime();
                        console.log(`[ASK] tool completed`);
                    } catch (err) {
                        console.error(`[Tool] Error:`, err.message);
                        timeResult = { error: `Time retrieval failed: ${err.message}` };
                    }

                    console.log(`[ASK] sending tool result to Gemini`);

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
                console.log(`[Gemini] Generating final response`);
                return part.text;
            }

            throw new Error("Received an unexpected content response structure (neither text nor functionCall).");
        }

        throw new Error("Function calling loop exceeded maximum limit.");
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
                    body: JSON.stringify(payload)
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
