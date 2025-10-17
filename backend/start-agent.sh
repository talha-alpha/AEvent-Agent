#!/bin/bash

# Script to run the LiveKit Agent backend
echo "Starting LiveKit Voice Agent Backend..."

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python -m venv venv
fi

# Activate virtual environment
source venv/bin/activate

# Install dependencies
echo "Installing dependencies..."
pip install -r requirements.txt

# Check for required environment variables
if [ -z "$LIVEKIT_URL" ]; then
    echo "Warning: LIVEKIT_URL not set. Please set your LiveKit server URL."
fi

if [ -z "$LIVEKIT_API_KEY" ]; then
    echo "Warning: LIVEKIT_API_KEY not set. Please set your LiveKit API key."
fi

if [ -z "$LIVEKIT_API_SECRET" ]; then
    echo "Warning: LIVEKIT_API_SECRET not set. Please set your LiveKit API secret."
fi

echo "Backend agent is ready. Run the following command when you have room connection details:"
echo "python agent.py --room-url <LIVEKIT_URL> --room-token <TOKEN> --room-name <ROOM_NAME>"
echo ""
echo "Or run the agent in CLI mode:"
echo "python agent.py"
