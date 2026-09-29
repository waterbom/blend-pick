"use client";
import RequestError from '@/components/RequestError';
export default function GlobalError(props: {error: Error & {digest?: string}; unstable_retry: () => void}) {
  return <html lang="ko"><body><RequestError {...props}/></body></html>;
}
