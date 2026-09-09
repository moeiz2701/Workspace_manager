import { redirect } from 'next/navigation';

// middleware.ts normally handles "/" — this is the fallback for the matcher's
// edge cases.
export default function RootPage() {
  redirect('/start');
}
