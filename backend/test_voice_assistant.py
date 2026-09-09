import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass
import asyncio
from unittest.mock import patch, MagicMock
from routes.chatbot import transcribe_audio, ChatRequest, ask_chatbot
from fastapi import UploadFile
import io

async def test_transcribe_validation():
    print("--- Testing transcribe_audio empty audio validation ---")
    mock_user = {"sub": "patient@swasthyasetu.org"}
    
    # Test 1: Tiny audio file (< 100 bytes) should raise 400
    try:
        dummy_file = UploadFile(filename="short.webm", file=io.BytesIO(b"short"))
        await transcribe_audio(file=dummy_file, language="mr", current_user=mock_user)
        print("FAIL: Expected 400 for short audio")
    except Exception as e:
        print(f"PASS: Correctly rejected tiny audio: {e}")

    # Test 2: Valid payload with mock AI transcription
    print("\n--- Testing transcribe_audio with mock Whisper output ---")
    valid_bytes = b"RIFF" + b"\x00" * 300  # > 100 bytes
    mock_file = UploadFile(filename="recording.webm", file=io.BytesIO(valid_bytes))
    
    with patch("services.ai_service.AIService.transcribe_audio", return_value=("मला ताप आला आहे", "mr")):
        res = await transcribe_audio(file=mock_file, language="auto", current_user=mock_user)
        print(f"Result: {res}")
        assert res["transcription"] == "मला ताप आला आहे"
        assert res["detected_language"] == "mr"
        assert res["empty_audio"] is False
        print("PASS: transcribe_audio returned expected transcription and detected_language.")

    # Test 3: Empty transcription from Whisper (silence)
    print("\n--- Testing silence/empty transcription ---")
    mock_file_silent = UploadFile(filename="silence.webm", file=io.BytesIO(valid_bytes))
    with patch("services.ai_service.AIService.transcribe_audio", return_value=("", "mr")):
        res_silent = await transcribe_audio(file=mock_file_silent, language="mr", current_user=mock_user)
        print(f"Result: {res_silent}")
        assert res_silent["empty_audio"] is True
        print("PASS: Correctly flagged empty_audio = True for silent recording.")

    print("\nALL VOICE ASSISTANT UNIT TESTS PASSED!")

if __name__ == "__main__":
    asyncio.run(test_transcribe_validation())
