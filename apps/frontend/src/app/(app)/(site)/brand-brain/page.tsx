import { Metadata } from 'next';
import { redirect } from 'next/navigation';

export const metadata: Metadata = {
  title: 'Postiz - Brand Brain',
  description: '',
};

export default async function Page() {
  return redirect('/brand-brain/new');
}
