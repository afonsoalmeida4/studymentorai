import { useEffect, useRef } from 'react';
import { apiRequest } from '@/lib/queryClient';

export function useStudyTimer(topicId: string | undefined) {
  const hasEntered = useRef(false);

  useEffect(() => {
    if (!topicId) return;

    // Send 'enter' event when topic loads
    if (!hasEntered.current) {
      hasEntered.current = true;
      apiRequest('POST', `/api/topics/${topicId}/session-events`, {
        eventType: 'enter',
      }).catch(err => console.error('Error tracking enter event:', err));
    }

    // Send 'exit' event when component unmounts
    return () => {
      if (hasEntered.current) {
        apiRequest('POST', `/api/topics/${topicId}/session-events`, {
          eventType: 'exit',
        }).catch(err => console.error('Error tracking exit event:', err));
      }
    };
  }, [topicId]);
}
