import { Metadata } from 'next';
import { Agent } from '@gitroom/frontend/components/agents/agent';

export const metadata: Metadata = {
  title: 'Postiz - Brand Brain',
  description: 'brand brain',
};

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <Agent basePath="/brand-brain">{children}</Agent>;
}
