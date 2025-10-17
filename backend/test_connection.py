#!/usr/bin/env python3
"""
Simple script to test LiveKit connection
Run this to verify your LiveKit credentials work
"""

import os
import asyncio
import sys
from livekit import agents

async def test_connection():
    """Test basic LiveKit connection"""
    print("Testing LiveKit connection...")

    # Check environment variables
    livekit_url = os.environ.get("LIVEKIT_URL", "wss://ai-agent-a5h6qng5.livekit.cloud")
    api_key = os.environ.get("LIVEKIT_API_KEY")
    api_secret = os.environ.get("LIVEKIT_API_SECRET")

    print(f"LIVEKIT_URL: {livekit_url}")
    print(f"LIVEKIT_API_KEY: {api_key[:10] + '...' if api_key else 'NOT SET'}")
    print(f"LIVEKIT_API_SECRET: {'SET' if api_secret else 'NOT SET'}")

    if not api_key or not api_secret:
        print("❌ Missing API credentials!")
        return False

    try:
        # Try to create a worker (this will test the connection)
        worker = agents.Worker(
            agents.WorkerOptions(
                entrypoint_fnc=lambda ctx: None,
                agent_name="test-agent",
                ws_url=livekit_url,
                api_key=api_key,
                api_secret=api_secret,
            )
        )

        print("✅ LiveKit connection test passed!")
        return True

    except Exception as e:
        print(f"❌ LiveKit connection failed: {e}")
        return False

if __name__ == "__main__":
    success = asyncio.run(test_connection())
    sys.exit(0 if success else 1)
