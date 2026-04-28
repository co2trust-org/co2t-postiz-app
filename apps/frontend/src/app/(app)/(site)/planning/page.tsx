import { Metadata } from 'next';
import { PlanningHub } from '@gitroom/frontend/components/planning/planning.hub';

export const metadata: Metadata = {
  title: 'Postiz - Planning',
  description: 'Marketing planning hub',
};

export default async function PlanningPage() {
  return <PlanningHub />;
}
