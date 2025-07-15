const axios = require('axios');
require('dotenv').config();

// Test Gemini API with a simple prompt
async function testGeminiAPI() {
    const apiKey = process.env.GEMMA_API_KEY;
    
    if (!apiKey) {
        console.log('❌ No API key found in .env file');
        return;
    }
    
    console.log('🔑 API Key found:', apiKey.substring(0, 10) + '...');
    
    const simplePrompt = "Generate 2 simple multiple choice questions about basic math. Return as JSON array with format: [{\"question\": \"...\", \"options\": [\"...\", \"...\", \"...\", \"...\"], \"correctAnswer\": 0, \"explanation\": \"...\"}]";
    
    const requestData = {
        contents: [{
            parts: [{
                text: simplePrompt
            }]
        }],
        generationConfig: {
            maxOutputTokens: 1000,
            temperature: 0.7
        }
    };
    
    console.log('📤 Sending simple test request...');
    console.log('⏱️  Starting timer...');
    
    const startTime = Date.now();
    
    try {
        const response = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/gemma-3n-e2b-it:generateContent?key=${apiKey}`,
            requestData,
            {
                timeout: 45000, // 45 seconds timeout
                headers: {
                    'Content-Type': 'application/json'
                }
            }
        );
        
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        console.log(`✅ API Response received in ${duration}ms`);
        console.log('📊 Response status:', response.status);
        
        if (response.data && response.data.candidates && response.data.candidates[0]) {
            const content = response.data.candidates[0].content;
            if (content && content.parts && content.parts[0]) {
                const text = content.parts[0].text;
                console.log('📝 Response text:');
                console.log(text.substring(0, 500) + (text.length > 500 ? '...' : ''));
                
                // Try to parse as JSON
                try {
                    const jsonData = JSON.parse(text);
                    console.log('✅ Valid JSON response received');
                    console.log('📋 Number of questions:', jsonData.length);
                } catch (parseError) {
                    console.log('⚠️  Response is not valid JSON');
                    console.log('🔍 Response might be text format');
                }
            }
        } else {
            console.log('❌ Unexpected response format');
            console.log('📄 Full response:', JSON.stringify(response.data, null, 2));
        }
        
    } catch (error) {
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        console.log(`❌ Error after ${duration}ms`);
        
        if (error.code === 'ECONNABORTED') {
            console.log('⏰ Request timed out');
        } else if (error.response) {
            console.log('🚫 API Error:', error.response.status);
            console.log('📄 Error details:', error.response.data);
        } else if (error.request) {
            console.log('🌐 Network error - no response received');
        } else {
            console.log('❓ Other error:', error.message);
        }
    }
}

// Run the test
console.log('🧪 Testing Gemini API...\n');
testGeminiAPI(); 