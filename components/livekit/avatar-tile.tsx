import React from 'react';
import { type TrackReference, VideoTrack } from '@livekit/components-react';
import { cn } from '@/lib/utils';

interface AgentAudioTileProps {
  videoTrack: TrackReference;
  className?: string;
}

export const AvatarTile = React.forwardRef<HTMLDivElement, AgentAudioTileProps>(
  ({ videoTrack, className }, ref) => {
    return (
      <div ref={ref} className={cn(className)}>
        <VideoTrack
          trackRef={videoTrack}
          width={videoTrack?.publication.dimensions?.width ?? 0}
          height={videoTrack?.publication.dimensions?.height ?? 0}
          className="rounded-md"
        />
      </div>
    );
  }
);

AvatarTile.displayName = 'AvatarTile';
