# Insite AI

Insite AI is a specialized, intelligent web-based assistant built using Flask and powered by Google's Gemini API. Designed primarily to aid students, it provides precise step-by-step guidance, real-time multimedia analysis, and interactive code execution directly inside the browser.

---

## Key Features

- Specialized Academic Assistance: Tailored system instructions and dynamic user preferences ensure expert guidance in Mathematics, Physics, Chemistry, and general student queries.
- Advanced Math and LaTeX Rendering: Automatically parses and renders mathematical expressions using KaTeX, ensuring clean, readable equations.
- Educational Chemistry and Step-by-Step Physics: Solves complex multi-step problems logically and breaks down chemical concepts clearly.
- Multimodal Support: Upload documents, study notes, or snap photos directly using phone native cameras or desktop webcam modals to capture homework and experiments.
- Voice Transcription: Built-in audio recording powered by Gemini, allowing users to speak questions and have them automatically transcribed into the chat box.
- Interactive HTML Previewer: Generates code blocks with instant language detection, copy-to-clipboard functionality, and a secure live HTML Preview Modal to render frontend code right inside the app.
- Secure User Authentication: Flask-Login backend ensuring secure user sessions with customizable AI preference prompts.

---

## Tech Stack

- Backend: Python, Flask, Flask-Login, Flask-SQLAlchemy
- AI Engine: Google GenAI SDK, Gemini Flash models
- Frontend: HTML5, CSS3, JavaScript, Bootstrap
- Libraries and Tools: Marked.js, KaTeX, FontAwesome

---

## Local Setup and Installation

To run or test Insite AI locally on your machine, follow these steps:

Step 1: Clone the repository
git clone https://github.com/Bumblebee2567/insiteAI.git
cd insiteAI

Step 2: Create and activate a virtual environment
python -m venv venv
For Windows: venv\Scripts\activate
For Mac and Linux: source venv/bin/activate

Step 3: Install dependencies
pip install -r requirements.txt

Step 4: Set up your environment variables
Create a .env file in the root directory and add your keys:
GEMINI_API_KEY=your_actual_api_key_here
SECRET_KEY=your_flask_secret_key_here

Step 5: Run the application
python run.py

Open your browser and navigate to http://127.0.0.1:5000.
