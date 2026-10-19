import { redirect } from 'next/navigation';

/** Booked deals live on the home page now, under the deal you're working on. */
export default function HistoryPage() {
  redirect('/');
}
