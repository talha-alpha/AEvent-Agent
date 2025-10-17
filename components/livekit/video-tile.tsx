import React from 'react';
import { motion } from 'motion/react';
import { VideoTrack } from '@livekit/components-react';
import { cn } from '@/lib/utils';

const MotionVideoTrack = motion.create(VideoTrack);

interface VideoTileProps {
  trackRef: React.ComponentProps<typeof VideoTrack>['trackRef'];
  className?: string;
}

export const VideoTile = React.forwardRef<HTMLDivElement, VideoTileProps>(
  ({ trackRef, className }, ref) => {
    return (
      <div ref={ref} className={cn('bg-muted overflow-hidden rounded-md', className)}>
        <MotionVideoTrack
          trackRef={trackRef}
          width={trackRef?.publication.dimensions?.width ?? 0}
          height={trackRef?.publication.dimensions?.height ?? 0}
          className={cn('h-full w-auto')}
        />
      </div>
    );
  }
);

VideoTile.displayName = 'VideoTile';
