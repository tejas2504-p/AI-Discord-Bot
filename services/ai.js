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
                    text: "You are a helpful assistant. The server clock is set to the India (Asia/Kolkata) timezone. When asked for the current date or time (especially today's date, current day, current year, current time, or current time/date in India), always call the `getCurrentDateTime` tool instead of searching the web."
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
                    body: JSON.stringify(requestBody)
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
                        throw new Error("Rate limit exceeded (Too Many Requests). Please wait a moment before trying again.");
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
    async generateContent(prompt, history = []) {
        if (!this.apiKey || this.apiKey === 'your_gemini_api_key_here') {
            throw new Error("AI feature is not configured. Please add a valid `GEMINI_API_KEY` to your `.env` file.");
        }

        console.log(`[AI] Processing user request`);

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

        const tools = [{
            functionDeclarations: [
                {
                    name: 'webSearch',
                    description: "Searches the web for current, recent, or real-time information, recent news, technology updates, current events, or any information that may have changed since the model's knowledge cutoff date. Do NOT use this tool for queries asking for the current date, current time, today's date, current day, or current year (use getCurrentDateTime instead).",
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
                    description: "Returns the current date and time using the server clock. Use this tool whenever the user asks for the current date, current time, today's date, current day, current year, or other real-time date/time information.",
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
                if (call.name === 'webSearch') {
                    const query = call.args.query;
                    
                    console.log(`[AI] Web search requested`);
                    console.log(`[WebSearch] Query: "${query}"`);
                    console.log(`[WebSearch] Calling Tavily`);
                    
                    let searchResults;
                    try {
                        searchResults = await searchService.search(query);
                        console.log(`[WebSearch] Results received`);
                    } catch (err) {
                        console.error(`[WebSearch] Error:`, err.message);
                        searchResults = [{ error: `Search failed: ${err.message}` }];
                    }

                    console.log(`[AI] Processing search results`);

                    // 1. Add model's turn requesting the function call
                    contents.push({
                        role: 'model',
                        parts: [
                            {
                                functionCall: {
                                    name: 'webSearch',
                                    args: { query }
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
                    console.log(`[AI] Current date/time requested`);
                    console.log(`[getCurrentDateTime] Calling time service`);
                    
                    let timeResult;
                    try {
                        timeResult = timeService.getCurrentDateTime();
                        console.log(`[getCurrentDateTime] Result received:`, timeResult);
                    } catch (err) {
                        console.error(`[getCurrentDateTime] Error:`, err.message);
                        timeResult = { error: `Time retrieval failed: ${err.message}` };
                    }

                    console.log(`[AI] Processing time results`);

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
                    console.warn(`[AI] Unsupported function call: ${call.name}`);
                    break;
                }
            }

            // If it returns text content
            if (part.text) {
                console.log(`[AI] Final response generated`);
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
