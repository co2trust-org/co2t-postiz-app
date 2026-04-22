import { Metadata } from 'next';
import { AgentChat } from '@gitroom/frontend/components/agents/agent.chat';

export const metadata: Metadata = {
  title: 'Postiz - Brand Brain',
  description: '',
};

export default async function Page() {
  return <AgentChat mode="brand-brain" />;
}
