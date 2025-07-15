# MCQ Generator - Interactive Learning Platform

A comprehensive web application that generates Multiple Choice Questions (MCQs) from syllabus materials, including PDF files and web content. The application provides detailed reports with grades, scores, and learning resources.

## Features

- **PDF Analysis**: Upload and analyze PDF files to extract content and generate MCQs
- **Web Scraping**: Extract content from URLs and generate MCQs
- **Interactive Quiz**: Take quizzes with a modern, responsive interface
- **Detailed Reports**: Get comprehensive reports including:
  - Grade and percentage scores
  - Areas for improvement
  - Learning resources (articles and videos)
  - Detailed answer analysis
- **Keyboard Navigation**: Navigate through questions using arrow keys and number keys
- **Progress Tracking**: Visual progress bar and question counter
- **Responsive Design**: Works on desktop and mobile devices

## Prerequisites

- Node.js (version 14 or higher)
- npm (Node Package Manager)
- Google Gemma API Key (for AI-powered MCQ generation) - Optional but recommended

## Installation

1. **Clone or download the project files**

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Set up Google Gemma API Key (Optional but Recommended)**:
   ```bash
   # Get your API key from: https://aistudio.google.com/app/apikey
   # Edit the config.env file and replace 'your-gemma-api-key-here' with your actual API key:
   # GEMMA_API_KEY=your-actual-api-key-here
   ```

4. **Start the application**:
   ```bash
   npm start
   ```

5. **Access the application**:
   Open your web browser and navigate to `http://localhost:3000`

## Usage

### Method 1: Use Existing Operating Systems PDF
- Click the "Use Existing Operating Systems PDF" button
- The application will automatically process the PDF in the `subject1` folder
- Start taking the quiz immediately

### Method 2: Upload a PDF File
1. Click on the "Upload PDF" section
2. Click "Choose PDF File" and select your PDF
3. The application will analyze the PDF and generate MCQs
4. Start taking the quiz

### Method 3: Enter a URL
1. Click on the "Enter URL" section
2. Enter a valid URL in the input field
3. The application will scrape the content and generate MCQs
4. Start taking the quiz

### Taking the Quiz
- Navigate through questions using "Previous" and "Next" buttons
- Select answers by clicking on options or using number keys (1-4)
- Use arrow keys for navigation
- Click "Submit Quiz" when finished

### Viewing Results
After submitting the quiz, you'll see:
- **Grade and Score**: Your overall performance
- **Statistics**: Total questions, correct answers, and average score
- **Areas for Improvement**: Questions you answered incorrectly
- **Learning Resources**: Links to articles and videos for further study

## Project Structure

```
ai-learn/
├── server.js              # Main server file
├── package.json           # Dependencies and scripts
├── README.md             # This file
├── config.env            # Environment configuration (API keys)
├── public/
│   ├── index.html        # Main HTML interface
│   └── script.js         # Frontend JavaScript
├── subject1/
│   └── R20CSE2202-OPERATING-SYSTEMS.pdf  # Sample PDF
└── uploads/              # Temporary file storage (created automatically)
```

## API Endpoints

- `GET /` - Serve the main HTML page
- `POST /api/generate-mcq-pdf` - Generate MCQs from uploaded PDF
- `POST /api/generate-mcq-url` - Generate MCQs from URL content
- `GET /api/process-subject1` - Process existing PDF in subject1 folder
- `POST /api/submit-quiz` - Submit quiz answers and get report

## Technologies Used

### Backend
- **Express.js**: Web framework for Node.js
- **pdf-parse**: PDF text extraction
- **axios**: HTTP client for web scraping and API calls
- **cheerio**: HTML parsing for web scraping
- **multer**: File upload handling
- **cors**: Cross-origin resource sharing
- **Google Gemma API**: AI-powered MCQ generation

### Frontend
- **Vanilla JavaScript**: No framework dependencies
- **HTML5**: Semantic markup
- **CSS3**: Modern styling with gradients and animations
- **Font Awesome**: Icons

## Customization

### Adding New Subjects
1. Create a new folder in the root directory (e.g., `subject2`)
2. Add PDF files to the folder
3. Modify the server.js file to add new API endpoints for the new subjects

### Modifying MCQ Generation
The MCQ generation uses AI-powered generation with Google Gemma API when available, with a fallback to simple keyword-based generation. You can:
- Change the number of questions generated
- Modify the prompt template for AI generation
- Adjust the keyword extraction logic for fallback
- Customize the grading system
- Switch between different AI models by changing the API endpoint

### Styling
The application uses CSS custom properties and modern styling. You can modify the colors, fonts, and layout in the `<style>` section of `index.html`.

## Troubleshooting

### Common Issues

1. **Port already in use**:
   - Change the port in `server.js` (line 10)
   - Or kill the process using the port

2. **PDF processing errors**:
   - Ensure the PDF is not password protected
   - Check if the PDF contains extractable text
   - Verify the PDF file is not corrupted

3. **Web scraping issues**:
   - Some websites may block scraping
   - Check if the URL is accessible
   - Verify the website doesn't require authentication

4. **Dependencies not found**:
   - Run `npm install` again
   - Check if Node.js version is compatible
   - Clear npm cache: `npm cache clean --force`

5. **Google Gemma API connection issues**:
   - Ensure your API key is correctly set in `config.env` file
   - Check if the API key is valid by testing it directly
   - Verify your internet connection for API calls
   - Check the Google AI Studio status at https://aistudio.google.com/

## Development

### Running in Development Mode
```bash
npm run dev
```
This uses nodemon for automatic server restart on file changes.

### Adding New Features
1. Modify the server.js file for backend changes
2. Update the HTML/CSS/JavaScript in public/ for frontend changes
3. Test thoroughly before deployment

## License

This project is open source and available under the MIT License.

## Contributing

Feel free to contribute to this project by:
- Reporting bugs
- Suggesting new features
- Submitting pull requests
- Improving documentation

## Support

For support or questions, please create an issue in the project repository or contact the development team. 