import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

export async function POST(request: NextRequest) {
  try {
    const { roomUrl, roomToken, roomName } = await request.json();

    if (!roomUrl || !roomToken || !roomName) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    // Path to backend folder
    const backendPath = path.join(process.cwd(), '..', 'backend');
    const pythonPath = path.join(backendPath, 'venv', 'Scripts', 'python.exe');
    const agentPath = path.join(backendPath, 'agent.py');

    console.log('Starting agent with:', {
      pythonPath,
      agentPath,
      roomName,
    });

    // Check if files exist
    if (!fs.existsSync(pythonPath)) {
      console.error('Python executable not found:', pythonPath);
      return NextResponse.json(
        { error: 'Python executable not found' },
        { status: 500 }
      );
    }

    if (!fs.existsSync(agentPath)) {
      console.error('Agent script not found:', agentPath);
      return NextResponse.json(
        { error: 'Agent script not found' },
        { status: 500 }
      );
    }

    return new Promise((resolve) => {
      // Spawn the Python process
      const agentProcess = spawn(
        pythonPath,
        [
          agentPath,
          'start',  // Use the 'start' command from livekit agents CLI
        ],
        {
          cwd: backendPath,
          env: {
            ...process.env,
            LIVEKIT_URL: process.env.LIVEKIT_URL || '',
            LIVEKIT_API_KEY: process.env.LIVEKIT_API_KEY || '',
            LIVEKIT_API_SECRET: process.env.LIVEKIT_API_SECRET || '',
            OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
            DEEPGRAM_API_KEY: process.env.DEEPGRAM_API_KEY || '',
            CARTESIA_API_KEY: process.env.CARTESIA_API_KEY || '',
          },
          stdio: ['pipe', 'pipe', 'pipe'],
        }
      );

      let hasConnected = false;
      let connectionTimeout: NodeJS.Timeout;

      // Set a timeout for connection (15 seconds)
      connectionTimeout = setTimeout(() => {
        if (!hasConnected) {
          console.log('Agent connection timeout - but agent may still be starting');
          hasConnected = true; // Prevent duplicate responses
          resolve(NextResponse.json({
            success: true,
            message: 'Agent process started (connection in progress)',
          }));
        }
      }, 15000);

      // Capture stdout
      agentProcess.stdout.on('data', (data) => {
        const output = data.toString();
        console.log('Backend agent stdout:', output);

        // Check if agent successfully connected
        if (output.includes('Agent successfully connected to room') || 
            output.includes('starting worker')) {
          if (!hasConnected) {
            hasConnected = true;
            clearTimeout(connectionTimeout);
            console.log('Agent started successfully');
            resolve(NextResponse.json({
              success: true,
              message: 'Agent started successfully',
            }));
          }
        }
      });

      // Capture stderr for debugging
      agentProcess.stderr.on('data', (data) => {
        console.error('Backend agent stderr:', data.toString());
      });

      agentProcess.on('error', (error) => {
        console.error('Failed to start agent process:', error);
        if (!hasConnected) {
          clearTimeout(connectionTimeout);
          hasConnected = true;
          resolve(NextResponse.json(
            { error: `Failed to start agent: ${error.message}` },
            { status: 500 }
          ));
        }
      });

      agentProcess.on('exit', (code) => {
        console.log(`Backend agent exited with code ${code}`);
        if (!hasConnected) {
          clearTimeout(connectionTimeout);
          hasConnected = true;
          resolve(NextResponse.json(
            { error: `Agent exited with code ${code}` },
            { status: 500 }
          ));
        }
      });
    });

  } catch (error) {
    console.error('Error in start-agent API:', error);
    return NextResponse.json(
      { error: `Internal server error: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 }
    );
  }
}