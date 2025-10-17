@echo off
echo Starting LiveKit Voice Agent Backend...

REM Check if virtual environment exists
if not exist "venv" (
    echo Creating virtual environment...
    python -m venv venv
)

REM Activate virtual environment
call venv\Scripts\activate.bat

REM Install dependencies
echo Installing dependencies...
pip install -r requirements.txt

REM Check for required environment variables
if "%LIVEKIT_URL%"=="" (
    echo Warning: LIVEKIT_URL not set. Please set your LiveKit server URL.
)

if "%LIVEKIT_API_KEY%"=="" (
    echo Warning: LIVEKIT_API_KEY not set. Please set your LiveKit API key.
)

if "%LIVEKIT_API_SECRET%"=="" (
    echo Warning: LIVEKIT_API_SECRET not set. Please set your LiveKit API secret.
)

echo Backend agent is ready. Run the following command when you have room connection details:
echo python agent.py --room-url [LIVEKIT_URL] --room-token [TOKEN] --room-name [ROOM_NAME]
echo.
echo Or run the agent in CLI mode:
echo python agent.py
pause
