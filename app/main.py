import os

from flask_login import (current_user)
from google import genai
from google.genai import types
from dotenv import load_dotenv

load_dotenv()

client = genai.Client(
    api_key=os.getenv("GEMINI_API_KEY")
)


def ask_gemini(conversation, file_path=None, mime_type=None):

    contents = []

    # ==========================================
    # CONVERSATION HISTORY
    # ==========================================

    for msg in conversation:

        role = msg["role"]
        content = msg.get("content", "")

        if content:
            contents.append(
                f"{role}: {content}"
            )


    # ==========================================
    # UPLOAD FILE IF PROVIDED
    # ==========================================

    if file_path:
        uploaded_file = client.files.upload(
            file=file_path,
            config={
                "mime_type": mime_type
            }
        )

        contents.append(uploaded_file)


    # ==========================================
    # ASK GEMINI
    # ==========================================

    response = client.models.generate_content(

        model="gemini-3.5-flash-lite",

        contents=contents,

        config=types.GenerateContentConfig(

            system_instruction=f"""

You are Insite AI, an AI assistant specializing
in mathematics, physics, chemistry and general
student assistance.

Use the conversation history to understand
previous messages.

If the user provides an image or document,
inspect the uploaded file and answer questions
about its contents.

For mathematics and physics problems, solve
step by step.

For chemistry questions, provide clear,
educational explanations.

If the uploaded file cannot be read, clearly
explain that.

Never claim to see information that is not
actually present in the uploaded file.

when writing a html code, always replace latex with pure html

{current_user.custom_prompt}

"""
        )
    )

    return response.text

def transcribe_audio(file_path):
    uploaded_audio = client.files.upload(
        file=file_path
    )

    response = client.models.generate_content(
        model="gemini-3.5-flash-lite",
        contents=[
            uploaded_audio,
            """
            Transcribe the audio exactly as spoken.

            Return only the transcription.
            Do not add explanations, summaries, or quotation marks.
            Preserve the speaker's words as accurately as possible.
            """
        ]
    )

    return response.text.strip()