require('dotenv').config();

async function getModels() {
    try {
        const response = await fetch('https://api.groq.com/openai/v1/models', {
            headers: {
                'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
            }
        });
        const data = await response.json();
        console.log("Available Groq Models:");
        if (data.data) {
            data.data.forEach(m => console.log(m.id));
        } else {
            console.log(data);
        }
    } catch (e) {
        console.error(e);
    }
}

getModels();
