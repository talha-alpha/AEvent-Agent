import os
import sys
import asyncio
import base64
import cv2
import numpy as np
from io import BytesIO

os.environ["LIVEKIT_TOKENIZE_USE_BASIC"] = "1"

from dotenv import load_dotenv
from livekit import agents, rtc
from livekit.agents import AgentSession, Agent, RoomInputOptions, cli, WorkerOptions
from livekit.plugins import openai, deepgram

load_dotenv()

# Import OpenAI directly
from openai import OpenAI


class VideoAnalysisAssistant(Agent):
    def __init__(self, session_context: dict = None) -> None:
        self.session_context = session_context or {}
        super().__init__(
            instructions="""You are a helpful AI assistant with vision capabilities. 
            You can see and analyze camera feeds and screen shares.
            When users ask what you see, describe it in detail using the latest analysis.
            Be conversational and helpful."""
        )
    
    async def on_message(self, message: str):
        """Handle incoming messages and incorporate visual analysis"""
        visual = self.session_context.get("latest_visual_analysis")
        if visual and ("see" in message.lower() or "what" in message.lower() or "show" in message.lower()):
            # User is asking about visual content, use the analysis
            return f"Based on my analysis of your {visual['type']}: {visual['analysis']}"
        return None


def analyze_frame_with_openai(frame_base64: str, source_type: str) -> str:
    """Analyze a frame using OpenAI's vision API - SYNCHRONOUS function"""
    try:
        client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        
        if not frame_base64.startswith("data:"):
            frame_base64 = f"data:image/jpeg;base64,{frame_base64}"
        
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": f"Describe what you see in this {source_type} in 2-3 sentences. Be specific."},
                        {"type": "image_url", "image_url": {"url": frame_base64}}
                    ]
                }
            ],
            max_tokens=300,
            timeout=10
        )
        
        result = response.choices[0].message.content
        print(f"✅ Analysis: {result[:100]}...", file=sys.stderr, flush=True)
        return result
        
    except Exception as e:
        print(f"❌ OpenAI Error: {e}", file=sys.stderr, flush=True)
        return ""


def frame_to_base64(frame_data: bytes, width: int, height: int) -> str:
    """Convert frame data to base64 JPEG"""
    try:
        img_array = np.frombuffer(frame_data, dtype=np.uint8)
        size_i420 = int(height * width * 1.5)
        
        # Try I420 format (most common from LiveKit)
        if len(img_array) >= size_i420:
            y_size = height * width
            u_size = (height // 2) * (width // 2)
            
            y = img_array[:y_size].reshape((height, width))
            u = img_array[y_size:y_size + u_size].reshape((height // 2, width // 2))
            v = img_array[y_size + u_size:].reshape((height // 2, width // 2))
            
            u = cv2.resize(u, (width, height))
            v = cv2.resize(v, (width, height))
            
            img_array = cv2.merge([y, u, v])
            img_array = cv2.cvtColor(img_array, cv2.COLOR_YUV2BGR)
        else:
            # Try RGB
            size_rgb = height * width * 3
            if len(img_array) >= size_rgb:
                img_array = img_array[:size_rgb].reshape((height, width, 3))
                img_array = cv2.cvtColor(img_array, cv2.COLOR_RGB2BGR)
            else:
                return ""
        
        # Resize if needed
        if max(height, width) > 1024:
            ratio = 1024 / max(height, width)
            img_array = cv2.resize(img_array, (int(width * ratio), int(height * ratio)))
        
        # Encode to JPEG
        success, buffer = cv2.imencode('.jpg', img_array, [cv2.IMWRITE_JPEG_QUALITY, 85])
        if not success:
            return ""
        
        return base64.b64encode(buffer).decode()
        
    except Exception as e:
        print(f"❌ Frame conversion error: {e}", file=sys.stderr, flush=True)
        return ""


async def process_video_track(track: rtc.VideoTrack, source_type: str, session_context: dict):
    """Process video track and analyze frames"""
    print(f"🎥 Processing {source_type}: {track.sid}", file=sys.stderr, flush=True)
    
    video_stream = rtc.VideoStream(track)
    last_analysis_time = 0
    last_analysis = ""
    
    try:
        async for event in video_stream:
            frame = event.frame
            current_time = asyncio.get_event_loop().time()
            
            # Analyze every 10 seconds
            if current_time - last_analysis_time >= 10.0:
                print(f"🔍 Analyzing {source_type}...", file=sys.stderr, flush=True)
                
                try:
                    frame_data = frame.data.tobytes()
                    frame_base64 = frame_to_base64(frame_data, frame.width, frame.height)
                    
                    if frame_base64:
                        # Run OpenAI analysis in thread
                        analysis = await asyncio.to_thread(
                            analyze_frame_with_openai,
                            frame_base64,
                            source_type
                        )
                        
                        if analysis and analysis != last_analysis:
                            last_analysis = analysis
                            session_context["latest_visual_analysis"] = {
                                "type": source_type,
                                "analysis": analysis
                            }
                            print(f"✅ Stored analysis", file=sys.stderr, flush=True)
                    
                    last_analysis_time = current_time
                    
                except Exception as e:
                    print(f"❌ Analysis error: {e}", file=sys.stderr, flush=True)
                    last_analysis_time = current_time
                    
    except asyncio.CancelledError:
        print(f"⏸️ {source_type} processing stopped", file=sys.stderr, flush=True)
    except Exception as e:
        print(f"❌ Stream error: {e}", file=sys.stderr, flush=True)


async def monitor_video_tracks(ctx: agents.JobContext, session_context: dict):
    """Monitor video tracks"""
    print("🎬 Video monitor started", file=sys.stderr, flush=True)
    
    active_tasks = {}
    
    def on_track_subscribed(track: rtc.Track, publication: rtc.TrackPublication, participant: rtc.RemoteParticipant):
        if track.kind == rtc.TrackKind.KIND_VIDEO:
            source = publication.source
            source_type = "camera" if source == rtc.TrackSource.SOURCE_CAMERA else "screen share"
            print(f"📡 {source_type} track subscribed", file=sys.stderr, flush=True)
            
            task = asyncio.create_task(process_video_track(track, source_type, session_context))
            active_tasks[track.sid] = task
    
    def on_track_unsubscribed(track: rtc.Track, publication: rtc.TrackPublication, participant: rtc.RemoteParticipant):
        if track.sid in active_tasks:
            active_tasks[track.sid].cancel()
            del active_tasks[track.sid]
            print(f"📴 Track unsubscribed", file=sys.stderr, flush=True)
    
    ctx.room.on("track_subscribed", on_track_subscribed)
    ctx.room.on("track_unsubscribed", on_track_unsubscribed)
    
    # Check for existing tracks
    for participant in ctx.room.remote_participants.values():
        for publication in participant.track_publications.values():
            if publication.track and publication.track.kind == rtc.TrackKind.KIND_VIDEO:
                source = publication.source
                source_type = "camera" if source == rtc.TrackSource.SOURCE_CAMERA else "screen share"
                task = asyncio.create_task(process_video_track(publication.track, source_type, session_context))
                active_tasks[publication.track.sid] = task
    
    print(f"✅ Video monitor ready", file=sys.stderr, flush=True)


async def entrypoint(ctx: agents.JobContext):
    await ctx.connect()
    print(f"\n🎉 Connected to room: {ctx.room.name}\n", file=sys.stderr, flush=True)
    
    session_context = {"latest_visual_analysis": None}
    
    session = AgentSession(
        stt=deepgram.STT(model="nova-3", language="multi"),
        llm=openai.LLM(model="gpt-4o"),
        tts=openai.TTS(model="tts-1", voice="alloy"),
    )

    await session.start(
        room=ctx.room,
        agent=VideoAnalysisAssistant(session_context=session_context),
        room_input_options=RoomInputOptions(),
    )

    print("🤖 Agent ready\n", file=sys.stderr, flush=True)
    
    asyncio.create_task(monitor_video_tracks(ctx, session_context))
    
    # Give the session time to initialize before generating reply
    await asyncio.sleep(1)
    
    try:
        await session.generate_reply(
            instructions="Greet the user warmly and briefly. Say you can see and analyze their camera and screen share. Keep it to 1-2 sentences."
        )
    except Exception as e:
        print(f"⚠️ Greeting failed (non-fatal): {e}", file=sys.stderr, flush=True)


if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint))