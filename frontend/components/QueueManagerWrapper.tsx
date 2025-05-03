'use client';

import dynamic from 'next/dynamic';

// Dynamically import QueueManager with ssr: false
const QueueManager = dynamic(() => import('@/components/QueueManager'), { 
  ssr: false,
  loading: () => null
});

// This wrapper is a client component that can safely use dynamic with ssr: false
export default function QueueManagerWrapper() {
  return <QueueManager />;
}