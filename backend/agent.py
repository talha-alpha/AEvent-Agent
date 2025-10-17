import os
import sys
import argparse

# CRITICAL: Set this BEFORE any livekit imports
os.environ["LIVEKIT_TOKENIZE_USE_BASIC"] = "1"

from dotenv import load_dotenv
from livekit import agents
from livekit.agents import AgentSession, Agent, RoomInputOptions, tokenize, WorkerOptions, cli
from livekit.plugins import (
    openai,
    cartesia,
    deepgram,
)

load_dotenv()


class Assistant(Agent):
    def __init__(self) -> None:
        super().__init__(instructions="You are a helpful voice AI assistant.")


async def entrypoint(ctx: agents.JobContext):
    # Connect to the room
    await ctx.connect()
    
    print(f"Agent successfully connected to room: {ctx.room.name}", file=sys.stderr, flush=True)
    
    session = AgentSession(
        stt=deepgram.STT(model="nova-3", language="multi"),
        llm=openai.LLM(model="gpt-4o-mini"),
        tts=cartesia.TTS(
            model="sonic-2",
            voice="f786b574-daa5-4673-aa0c-cbe3e8534c02",
            tokenizer=tokenize.basic.SentenceTokenizer()
        ),
    )

    await session.start(
        room=ctx.room,
        agent=Assistant(),
        room_input_options=RoomInputOptions(),
    )

    print("Agent session started", file=sys.stderr, flush=True)

    await session.generate_reply(
        instructions="Greet the user and offer your assistance."
    )


if __name__ == "__main__":
    # Parse command line arguments (kept for compatibility but not used)
    parser = argparse.ArgumentParser(description="LiveKit Voice Agent")
    parser.add_argument("--room-url", help="LiveKit server URL")
    parser.add_argument("--room-token", help="Participant token")
    parser.add_argument("--room-name", help="Room name")
    
    args, unknown = parser.parse_known_args()
    
    # Log that we're starting
    if args.room_name:
        print(f"Starting agent for room: {args.room_name}", file=sys.stderr, flush=True)
    
    print(f"Using LiveKit URL: {os.environ.get('LIVEKIT_URL')}", file=sys.stderr, flush=True)
    
    # Run the agent - it will automatically connect to any room that needs an agent
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint))