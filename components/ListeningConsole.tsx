'use client';

import React from 'react';
import { motion } from 'motion/react';
import { useTranscriptions, useVoiceAssistant, type AgentState } from '@livekit/components-react';
import { cn } from '@/lib/utils';

interface ListeningConsoleProps {
  className?: string;
}

export const ListeningConsole = ({ className }: ListeningConsoleProps) => {
  const transcriptions = useTranscriptions();
  const { state: agentState } = useVoiceAssistant();

  // Get the latest transcription
  const latestTranscription = transcriptions[transcriptions.length - 1];

  const getStatusIcon = () => {
    switch (agentState) {
      case 'listening':
        return '🎤';
      case 'thinking':
        return '🤔';
      case 'speaking':
        return '🗣️';
      default:
        return '⚪';
    }
  };

  const getStatusText = () => {
    switch (agentState) {
      case 'listening':
        return 'Listening...';
      case 'thinking':
        return 'Processing...';
      case 'speaking':
        return 'Speaking...';
      case 'connecting':
        return 'Connecting...';
      case 'disconnected':
        return 'Disconnected';
      default:
        return 'Ready';
    }
  };

  const getStatusColor = () => {
    switch (agentState) {
      case 'listening':
        return 'text-green-400 bg-green-500/10 border-green-500/20';
      case 'thinking':
        return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
      case 'speaking':
        return 'text-purple-400 bg-purple-500/10 border-purple-500/20';
      default:
        return 'text-gray-400 bg-gray-500/10 border-gray-500/20';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'fixed top-4 left-4 z-50 max-w-sm',
        'bg-black/80 backdrop-blur-sm rounded-lg border p-4',
        'text-white shadow-lg',
        className
      )}
    >
      <div className="flex items-center gap-3 mb-3">
        <div className="text-lg">
          {getStatusIcon()}
        </div>
        <div className="flex-1">
          <div className={cn('text-sm font-medium', getStatusColor())}>
            {getStatusText()}
          </div>
        </div>
      </div>

      {latestTranscription && agentState === 'listening' && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="bg-gray-900/50 rounded-md p-3 border border-gray-700/50"
        >
          <div className="text-xs text-gray-400 mb-1">Recognizing speech...</div>
          <div className="text-sm text-gray-200 min-h-[1.5rem]">
            {latestTranscription.text || 'Listening...'}
          </div>
          {latestTranscription.participantInfo && (
            <div className="text-xs text-gray-500 mt-1">
              {latestTranscription.participantInfo.identity === 'local' ? 'You' : latestTranscription.participantInfo.identity}
            </div>
          )}
        </motion.div>
      )}

      {agentState === 'thinking' && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="bg-blue-900/20 rounded-md p-3 border border-blue-700/30"
        >
          <div className="text-xs text-blue-400 mb-1">AI Processing...</div>
          <div className="text-sm text-blue-200">Analyzing your request...</div>
        </motion.div>
      )}

      {transcriptions.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-700/50">
          <div className="text-xs text-gray-400 mb-2">Recent transcriptions:</div>
          <div className="max-h-32 overflow-y-auto space-y-1">
            {transcriptions.slice(-3).map((transcription, index) => (
              <div
                key={transcription.streamInfo.id}
                className="text-xs text-gray-300 bg-gray-800/30 rounded px-2 py-1"
              >
                <span className="text-gray-400">
                  {transcription.participantInfo?.identity === 'local' ? 'You: ' : 'Agent: '}
                </span>
                {transcription.text}
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
};
