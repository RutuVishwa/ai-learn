// Load environment variables
require('dotenv').config();

const express = require('express');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./quiz_cache.db');
const yts = require('youtube-search-api');


db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS quiz_cache (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subject TEXT UNIQUE,
    mcqs_json TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);
});

function saveMCQsToDB(subject, mcqs) {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO quiz_cache (subject, mcqs_json) VALUES (?, ?)
       ON CONFLICT(subject) DO UPDATE SET mcqs_json=excluded.mcqs_json, created_at=CURRENT_TIMESTAMP`,
      [subject, JSON.stringify(mcqs)],
      function (err) {
        if (err) reject(err);
        else resolve();
      }
    );
  });
}

function loadMCQsFromDB(subject) {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT mcqs_json FROM quiz_cache WHERE subject = ?`,
      [subject],
      (err, row) => {
        if (err) reject(err);
        else if (row && row.mcqs_json) resolve(JSON.parse(row.mcqs_json));
        else resolve(null);
      }
    );
  });
}

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ storage: storage });

// Create uploads directory if it doesn't exist
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}

// Function to extract text from PDF
async function extractTextFromPDF(filePath) {
  try {
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdfParse(dataBuffer);
    return data.text;
  } catch (error) {
    console.error('Error extracting text from PDF:', error);
    throw error;
  }
}

// Function to scrape content from URL
async function scrapeContentFromURL(url) {
  try {
    const response = await axios.get(url);
    const $ = cheerio.load(response.data);
    
    // Remove script and style elements
    $('script').remove();
    $('style').remove();
    
    // Extract text content
    const text = $('body').text().replace(/\s+/g, ' ').trim();
    return text;
  } catch (error) {
    console.error('Error scraping content from URL:', error);
    throw error;
  }
}

// Google Gemma API Configuration
const GEMMA_API_KEY = process.env.GEMMA_API_KEY || 'your-gemma-api-key-here';
const GEMMA_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemma-3n-e2b-it:generateContent';

// Function to check if Google Gemma API is available
async function checkGemmaAvailability() {
  if (!GEMMA_API_KEY || GEMMA_API_KEY === 'your-gemma-api-key-here') {
    console.log('❌ Google Gemma API key not configured. Using fallback MCQ generation.');
    console.log('To use Google Gemma API, set the GEMMA_API_KEY environment variable.');
    return false;
  }
  
  try {
    // Test the API with a simple request
    const response = await axios.post(`${GEMMA_API_URL}?key=${GEMMA_API_KEY}`, {
      contents: [
        {
          parts: [
            {
              text: 'Hello, can you respond with "API working"?'
            }
          ]
        }
      ],
      generationConfig: {
        maxOutputTokens: 10,
        temperature: 0.1
      }
    }, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });
    
    console.log('✅ Google Gemma API connected successfully');
    return true;
  } catch (error) {
    console.log('❌ Google Gemma API not available. Using fallback MCQ generation.');
    console.log('Error:', error.response?.data?.error?.message || error.message);
    return false;
  }
}

// Check Google Gemma availability on startup
let gemmaAvailable = false;
checkGemmaAvailability().then(available => {
  gemmaAvailable = available;
});

// Function to generate MCQs using Google Gemma API
async function generateMCQs(content, numQuestions = 10) {
  // If Google Gemma API is not available, use fallback
  if (!gemmaAvailable) {
    console.log('Using fallback MCQ generation (Google Gemma API not available)');
    return generateSimpleMCQs(content, numQuestions);
  }

  try {
    // Truncate content if too long to avoid token limits
    const maxContentLength = 8000;
    const truncatedContent = content.length > maxContentLength 
      ? content.substring(0, maxContentLength) + "..."
      : content;

    const prompt = `You are an expert educator creating multiple choice questions from educational content. 
Based on the following content, generate ${numQuestions} high-quality multiple choice questions.

Content:
${truncatedContent}

Generate questions in the following JSON format:
[
  {
    "id": 1,
    "question": "Clear, specific question about the content",
    "options": [
      "Correct answer (detailed and accurate)",
      "Plausible but incorrect option",
      "Another plausible but incorrect option", 
      "Clearly incorrect option"
    ],
    "correctAnswer": 0,
    "explanation": "Detailed explanation of why the correct answer is right"
  }
]

Requirements:
- Questions should test understanding, not just memorization
- All options should be plausible and well-written
- Correct answer should be option 0 (first option)
- Explanations should be educational and helpful
- Focus on key concepts and important details from the content
- Make questions challenging but fair

Generate exactly ${numQuestions} questions in valid JSON format:`;

    // Use Google Gemma API
    const response = await axios.post(`${GEMMA_API_URL}?key=${GEMMA_API_KEY}`, {
      contents: [
        {
          parts: [
            {
              text: prompt
            }
          ]
        }
      ],
      generationConfig: {
        maxOutputTokens: 4000,
        temperature: 0.7
      }
    }, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });

    const result = response.data.candidates[0].content.parts[0].text;

    // Parse the JSON response
    let mcqs;
    try {
      // Remove code block markers if present
      let cleanResult = result.replace(/```json|```/g, '').trim();
      // Extract JSON from the response (in case there's extra text)
      const jsonMatch = cleanResult.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        mcqs = JSON.parse(jsonMatch[0]);
      } else {
        mcqs = JSON.parse(cleanResult);
      }
    } catch (parseError) {
      console.error('Error parsing MCQ response:', parseError);
      console.log('Raw response:', result);
      // Fallback to simple generation if parsing fails
      return generateSimpleMCQs(content, numQuestions);
    }

    // Validate and clean the MCQs
    const validMCQs = mcqs.filter(mcq => 
      mcq.question && 
      mcq.options && 
      Array.isArray(mcq.options) && 
      mcq.options.length === 4 &&
      typeof mcq.correctAnswer === 'number' &&
      mcq.correctAnswer >= 0 && 
      mcq.correctAnswer < 4
    );

    console.log(`✅ Generated ${validMCQs.length} MCQs using Google Gemma API`);
    return validMCQs.slice(0, numQuestions);

  } catch (error) {
    console.error('Error generating MCQs with Google Gemma API:', error);
    // Fallback to simple generation
    return generateSimpleMCQs(content, numQuestions);
  }
}

// Fallback function for simple MCQ generation
function generateSimpleMCQs(content, numQuestions = 10) {
  const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 20);
  const mcqs = [];
  
  // Simple keyword extraction and question generation
  const keywords = extractKeywords(content);
  
  for (let i = 0; i < Math.min(numQuestions, keywords.length); i++) {
    const keyword = keywords[i];
    // Randomly assign correct answer to different positions (0-3)
    const correctAnswerIndex = Math.floor(Math.random() * 4);
    
    const mcq = {
      id: i + 1,
      question: `What is ${keyword}?`,
      options: [
        `The correct answer about ${keyword}`,
        `An incorrect option about ${keyword}`,
        `Another incorrect option about ${keyword}`,
        `Yet another incorrect option about ${keyword}`
      ],
      correctAnswer: correctAnswerIndex,
      explanation: `This question tests your knowledge about ${keyword}.`
    };
    mcqs.push(mcq);
  }
  
  return mcqs;
}

// Function to extract keywords from content
function extractKeywords(content) {
  const words = content.toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(word => word.length > 4);
  
  const wordFreq = {};
  words.forEach(word => {
    wordFreq[word] = (wordFreq[word] || 0) + 1;
  });
  
  return Object.keys(wordFreq)
    .sort((a, b) => wordFreq[b] - wordFreq[a])
    .slice(0, 20);
}

// Function to calculate grade and provide feedback
function calculateGrade(score, totalQuestions) {
  const percentage = (score / totalQuestions) * 100;
  
  let grade, feedback;
  if (percentage >= 90) {
    grade = 'A+';
    feedback = 'Excellent! You have a strong understanding of the material.';
  } else if (percentage >= 80) {
    grade = 'A';
    feedback = 'Great job! You have a good understanding of the material.';
  } else if (percentage >= 70) {
    grade = 'B';
    feedback = 'Good work! You have a solid understanding with room for improvement.';
  } else if (percentage >= 60) {
    grade = 'C';
    feedback = 'Fair performance. Review the material to improve your understanding.';
  } else if (percentage >= 50) {
    grade = 'D';
    feedback = 'You need to study more. Focus on the core concepts.';
  } else {
    grade = 'F';
    feedback = 'Significant improvement needed. Consider reviewing the basics.';
  }
  
  return { grade, percentage, feedback };
}

// Function to generate learning resources
function generateLearningResources(topic, grade) {
  const resources = {
    articles: [
      `https://en.wikipedia.org/wiki/${topic.replace(/\s+/g, '_')}`,
      `https://www.geeksforgeeks.org/${topic.toLowerCase().replace(/\s+/g, '-')}/`,
      `https://www.tutorialspoint.com/${topic.toLowerCase().replace(/\s+/g, '_')}/`
    ],
    videos: [
      `https://www.youtube.com/results?search_query=${encodeURIComponent(topic + ' tutorial')}`,
      `https://www.youtube.com/results?search_query=${encodeURIComponent(topic + ' lecture')}`,
      `https://www.youtube.com/results?search_query=${encodeURIComponent(topic + ' course')}`
    ]
  };
  
  return resources;
}

// API Routes

// Generate MCQs from PDF
app.post('/api/generate-mcq-pdf', upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No PDF file uploaded' });
    }
    
    const content = await extractTextFromPDF(req.file.path);
    const mcqs = await generateMCQs(content, 10);
    
    // Clean up uploaded file
    fs.unlinkSync(req.file.path);
    
    res.json({ mcqs, content: content.substring(0, 500) + '...' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Generate MCQs from URL
app.post('/api/generate-mcq-url', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }
    
    const content = await scrapeContentFromURL(url);
    const mcqs = await generateMCQs(content, 10);
    
    res.json({ mcqs, content: content.substring(0, 500) + '...' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Generate MCQs for a subject using Gemini
app.post('/api/generate-mcq-subject', async (req, res) => {
  try {
    const { subject } = req.body;
    if (!subject || typeof subject !== 'string' || !subject.trim()) {
      return res.status(400).json({ error: 'Subject name is required.' });
    }
    const prompt = `You are an expert educator. Generate 10 high-quality multiple choice questions (MCQs) for the subject: "${subject}". Each question should have 4 options, with one correct answer (can be at any position 0-3), and a detailed explanation. Return the result as a JSON array in the following format:\n[\n  {\n    "id": 1,\n    "question": "...",\n    "options": ["...", "...", "...", "..."],\n    "correctAnswer": 0,\n    "explanation": "..."\n  }\n]\nFocus on important concepts and make the questions challenging but fair. The correctAnswer should be the index (0-3) of the correct option. Do not include any text before or after the JSON array.`;
    let mcqs;
    try {
      mcqs = await generateMCQs(prompt, 10);
      if (mcqs && Array.isArray(mcqs) && mcqs.length > 0) {
        await saveMCQsToDB(subject, mcqs);
        // Print MCQs and correct answers to terminal
        console.log(`\nGenerated MCQs for subject: ${subject}`);
        mcqs.forEach((q, idx) => {
          console.log(`\nQ${idx + 1}: ${q.question}`);
          q.options.forEach((opt, i) => {
            const marker = (i === q.correctAnswer) ? ' (correct)' : '';
            console.log(`  ${String.fromCharCode(65 + i)}. ${opt}${marker}`);
          });
        });
      }
    } catch (apiError) {
      // On API failure, try to load from DB
      mcqs = await loadMCQsFromDB(subject);
      if (!mcqs) {
        return res.status(500).json({ error: 'Failed to generate quiz and no cached quiz found for this subject.' });
      }
    }
    res.json({ mcqs });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Process existing PDF in subject1 folder
app.get('/api/process-subject1', async (req, res) => {
  try {
    const pdfPath = path.join(__dirname, 'subject1', 'R20CSE2202-OPERATING-SYSTEMS.pdf');
    
    if (!fs.existsSync(pdfPath)) {
      return res.status(404).json({ error: 'PDF file not found in subject1 folder' });
    }
    
    const content = await extractTextFromPDF(pdfPath);
    const mcqs = await generateMCQs(content, 15);
    
    res.json({ 
      mcqs, 
      subject: 'Operating Systems',
      content: content.substring(0, 500) + '...' 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Submit quiz and get report
app.post('/api/submit-quiz', async (req, res) => {
  try {
    const { answers, mcqs, subject } = req.body;
    if (!answers || !mcqs) {
      return res.status(400).json({ error: 'Answers and MCQs are required' });
    }
    let correctAnswers = 0;
    const detailedAnswers = [];
    const wrongQuestions = [];
    mcqs.forEach((mcq, index) => {
      const userAnswer = answers[index];
      const isCorrect = userAnswer === mcq.correctAnswer;
      if (isCorrect) correctAnswers++;
      else wrongQuestions.push(mcq);
      detailedAnswers.push({
        question: mcq.question,
        userAnswer: mcq.options[userAnswer],
        correctAnswer: mcq.options[mcq.correctAnswer],
        isCorrect,
        explanation: mcq.explanation
      });
    });
    const { grade, percentage, feedback } = calculateGrade(correctAnswers, mcqs.length);
    // Personalized YouTube video links for wrong answers (direct video links)
    let videoLinks = [];
    if (wrongQuestions.length > 0) {
      for (const q of wrongQuestions) {
        const query = (subject ? subject + ' ' : '') + q.question + ' tutorial';
        try {
          const ytRes = await yts.GetListByKeyword(query, false, 5);
          const firstVideo = ytRes.items && ytRes.items.find(item => item.videoId);
          if (firstVideo && firstVideo.videoId) {
            videoLinks.push('https://www.youtube.com/watch?v=' + firstVideo.videoId);
          } // else: skip adding a link if no videoId found
        } catch (e) {
          // skip adding a link if error
        }
      }
    } else {
      // If all correct, show general subject video if available
      const query = (subject || 'General') + ' tutorial';
      try {
        const ytRes = await yts.GetListByKeyword(query, false, 5);
        const firstVideo = ytRes.items && ytRes.items.find(item => item.videoId);
        if (firstVideo && firstVideo.videoId) {
          videoLinks = ['https://www.youtube.com/watch?v=' + firstVideo.videoId];
        } else {
          videoLinks = [];
        }
      } catch (e) {
        videoLinks = [];
      }
    }
    const learningResources = {
      articles: [
        `https://en.wikipedia.org/wiki/${(subject || 'General').replace(/\s+/g, '_')}`,
        `https://www.geeksforgeeks.org/${(subject || 'General').toLowerCase().replace(/\s+/g, '-')}/`,
        `https://www.tutorialspoint.com/${(subject || 'General').toLowerCase().replace(/\s+/g, '_')}/`
      ],
      videos: videoLinks
    };
    const report = {
      subject: subject || 'General',
      totalQuestions: mcqs.length,
      correctAnswers,
      score: correctAnswers,
      percentage,
      grade,
      feedback,
      detailedAnswers,
      learningResources,
      average: percentage,
      improvementAreas: detailedAnswers
        .filter(answer => !answer.isCorrect)
        .map(answer => answer.question)
    };
    res.json(report);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Check Google Gemma API status
app.get('/api/ai-status', (req, res) => {
  res.json({ 
    available: gemmaAvailable,
    model: gemmaAvailable ? 'gemma-3n-e2b-it' : null
  });
});

// Serve the main HTML page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
}); 