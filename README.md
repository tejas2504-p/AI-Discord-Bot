# AI Discord Bot

##  Overview

An intelligent, conversational Discord chatbot built with **Node.js** and **Discord.js (v14)**, powered by the **Google Gemini AI API** and backed by **MongoDB**. 

It features dynamic slash commands, isolated user-level chat memory, automated retry policies for AI network calls, and robust database persistence.

---

##  Features

*   **Intelligent Conversations (`/ask`):** Talk to the AI bot naturally. It remembers previous context and responses, creating a true conversational flow.
*   **Chat Memory Control (`/reset`):** Instantly wipe your personal chat history with the bot to start a fresh topic or clear context.
*   **Code Generation & Explanation (`/code`):** Generate high-quality programming scripts and code snippets in any language (Python, JavaScript, C++, etc.) with clean documentation and step-by-step explanations.
*   **Translation (`/translate`):** Translate text directly to and from Spanish, Japanese, French, German, or any target language instantly.
*   **Image Generation (`/generate-image`):** Generate high-quality images from a text prompt using Google's Imagen 3.0 model, with customizable aspect ratio options (1:1, 16:9, 9:16, 4:3, 3:4).
*   **Study Assistant Suite:**
    *   **Generate Notes (`/notes`):** Automatically generate clean, structured study notes on any topic.
    *   **Create Quizzes (`/quiz`):** Create customizable multiple-choice quizzes with answers and detailed explanations.
    *   **Tailored Explanations (`/explain`):** Explain complex concepts with analogies tailored to Beginner, Intermediate, or Advanced audiences.
    *   **Mock Interviews (`/interview`):** Conduct an interactive practice interview on any job role or topic with live feedback, session memory, and final evaluations.
*   **Reliability & Resilience:** 
    *   **Mongoose Integration:** Connects to MongoDB Atlas to persist conversations across bot restarts.
    *   **Smart AI Retry Policy:** Automatically retries failed Gemini API calls (like `503 Service Unavailable`) using exponential backoff.
    *   **User-Friendly Error Catching:** Friendly descriptions are returned in chat for rate limits (`429`) or server outages.

---

##  Technology Stack

*   **Runtime:** Node.js (v18+)
*   **Discord Framework:** Discord.js v14
*   **AI Engine:** Google Gemini API (via Native Fetch)
*   **Database Object Modeling:** Mongoose & MongoDB Atlas
*   **Environment Configuration:** Dotenv

---

## ⚙️ Configuration & Installation

### 1. Prerequisites
Ensure you have the following installed on your machine:
*   [Node.js](https://nodejs.org/) (v18.0.0 or higher)
*   A [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) cluster (or local MongoDB database)

### 2. Setup Guide

Clone this repository and navigate to the project directory:
```bash
git clone https://github.com/your-username/AI-Discord-Bot.git
cd AI-Discord-Bot
```

Install all required packages:
```bash
npm install
```

### 3. Environment Variables (`.env`)
Create a `.env` file in the root directory and configure the following variables:

```env
DISCORD_TOKEN=your_discord_bot_token
CLIENT_ID=your_discord_client_application_id
GUILD_ID=your_testing_server_id (optional, instant command updates)
GEMINI_API_KEY=your_gemini_api_key
MONGO_URI=your_mongodb_connection_uri
```

> [!IMPORTANT]
> **MongoDB Password Warning**: If your MongoDB database password contains special characters (like `@`, `?`, `/`, or `#`), you **must** URL-encode them in the `MONGO_URI`. For example, replace `@` with `%40`.
> 
> **SRV Record DNS Issue**: If you encounter connection issues or `querySrv ECONNREFUSED` errors in Node, configure the standard `mongodb://` replica-set format instead of `mongodb+srv://` inside your `.env` file.

---

##  Running the Bot

### Step 1: Deploy Slash Commands
Before running the bot, you must register the commands with the Discord API:
```bash
node deploy-commands.js
```

### Step 2: Start the Bot
Run the bot locally:
```bash
node index.js
```

---

## 📂 Project Structure

```
├── commands/            # Slash Command Files
│   ├── ask.js           # Conversational AI with context
│   ├── reset.js         # Clear personal chat memory
│   ├── code.js          # Code generator & explainer
│   ├── translate.js     # Text translation engine
│   ├── generate-image.js # Image generation engine (Imagen 3)
│   ├── notes.js          # Study notes generator command
│   ├── quiz.js           # Multiple choice quiz creator command
│   ├── explain.js        # Conceptual explainer tool command
│   ├── interview.js      # Mock interview coordinator command (interactive)
│   └── ping.js          # Bot latency checker
├── config/
│   └── config.json      # Embed color and theme configuration
├── events/              # Discord.js Event Handlers
│   ├── interactionCreate.js
│   └── ready.js
├── services/            # Core Integration Services
│   ├── ai.js            # Gemini API requests & retry handlers
│   └── database.js      # MongoDB & Mongoose schemas
├── .env                 # Environment secrets (ignored by git)
├── deploy-commands.js   # Script to register slash commands
├── index.js             # Main entry point
└── package.json         # Node.js dependencies
```

---



##  Learn More & Resources

To dive deeper into the technologies powering this bot, explore these official resources:

*   **Discord.js Framework:**
    *   [Official Discord.js Documentation](https://discord.js.org/)
    *   [Discord.js Guide](https://discordjs.guide/) (Best starting point for building slash commands and events)
*   **Google Gemini AI:**
    *   [Google AI Studio Console](https://aistudio.google.com/) (Get API keys, adjust safety settings, and try prompts in the playground)
    *   [Gemini API Developer Documentation](https://ai.google.dev/docs)
*   **MongoDB & Mongoose:**
    *   [MongoDB Atlas Getting Started](https://www.mongodb.com/docs/atlas/getting-started/)
    *   [Mongoose Guide & API Reference](https://mongoosejs.com/docs/guide.html)

##  License

This project is licensed under the **ISC License**.

