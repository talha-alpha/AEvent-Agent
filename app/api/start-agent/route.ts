import { NextRequest, NextResponse } from 'next/server';
import { spawn, exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import { promisify } from 'util';

const execAsync = promisify(exec);

const activeAgents = new Map<string, any>();

async function killPort8081() {
  try {
    if (process.platform === 'win32') {
      // Windows: Kill process using port 8081
      await execAsync('netstat -ano | findstr :8081 && taskkill /F /PID <PID>', { shell: 'cmd.exe' }).catch(() => {});
      await execAsync('taskkill /F /IM python.exe 2>nul || exit 0').catch(() => {});
    } else {
      // Linux/Mac: Kill process on port 8081
      await execAsync('lsof -ti:8081 | xargs kill -9 2>/dev/null || true').catch(() => {});
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  } catch (e) {
  }
}

export async function POST(request: NextRequest) {
  try {
    const { roomUrl, roomToken, roomName } = await request.json();

    if (!roomUrl || !roomToken || !roomName) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    if (activeAgents.has(roomName)) {
      const existingAgent = activeAgents.get(roomName);
      try {
        existingAgent.kill('SIGKILL');
      } catch (e) {
      }
      activeAgents.delete(roomName);
    }

    try {
      if (process.platform === 'win32') {
        await execAsync('taskkill /F /IM python.exe /FI "IMAGENAME eq python.exe" 2>nul || exit 0').catch(() => {});
      } else {
        await execAsync('pkill -9 -f "python.*agent.py" || true').catch(() => {});
      }
      await killPort8081();
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (e) {
    }

    const backendPath = path.join(process.cwd(), '..', 'backend');
    const pythonPath = path.join(backendPath, 'venv', 'Scripts', 'python.exe');
    const agentPath = path.join(backendPath, 'agent.py');

    if (!fs.existsSync(pythonPath)) {
      return NextResponse.json(
        { error: 'Python executable not found. Ensure virtual environment is set up.' },
        { status: 500 }
      );
    }

    if (!fs.existsSync(agentPath)) {
      return NextResponse.json(
        { error: 'Agent script not found' },
        { status: 500 }
      );
    }

    return new Promise((resolve) => {
      const agentProcess = spawn(pythonPath, [agentPath, 'start'], {
        cwd: backendPath,
        env: {
          ...process.env,
          LIVEKIT_URL: process.env.LIVEKIT_URL || '',
          LIVEKIT_API_KEY: process.env.LIVEKIT_API_KEY || '',
          LIVEKIT_API_SECRET: process.env.LIVEKIT_API_SECRET || '',
          OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
          DEEPGRAM_API_KEY: process.env.DEEPGRAM_API_KEY || '',
        },
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      activeAgents.set(roomName, agentProcess);

      let hasConnected = false;
      let connectionTimeout: NodeJS.Timeout;

      connectionTimeout = setTimeout(() => {
        if (!hasConnected) {
          hasConnected = true;
          resolve(NextResponse.json({
            success: true,
            message: 'Agent process started',
          }));
        }
      }, 15000);

      agentProcess.stdout.on('data', (data) => {
        const output = data.toString();

        if ((output.includes('registered worker') || output.includes('starting worker')) && !hasConnected) {
          hasConnected = true;
          clearTimeout(connectionTimeout);
          resolve(NextResponse.json({ success: true, message: 'Agent started' }));
        }
      });

      agentProcess.stderr.on('data', (data) => {
      });

      agentProcess.on('error', (error) => {
        activeAgents.delete(roomName);
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
        activeAgents.delete(roomName);
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
    console.error('API error:', error);
    return NextResponse.json(
      { error: `Server error: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { roomName } = await request.json();
    
    if (roomName && activeAgents.has(roomName)) {
      const agent = activeAgents.get(roomName);
      agent.kill('SIGKILL');
      activeAgents.delete(roomName);
      await killPort8081();
      return NextResponse.json({ success: true, message: 'Agent stopped' });
    }
    
    return NextResponse.json({ success: false, message: 'No agent found' });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to stop agent' }, { status: 500 });
  }
}