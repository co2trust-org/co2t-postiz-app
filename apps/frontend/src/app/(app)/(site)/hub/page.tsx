import { Metadata } from 'next';
import { SiteHub } from '@gitroom/frontend/components/hub/site.hub';

export const metadata: Metadata = {
  title: 'Postiz - Marketing home',
  description: 'Marketing status, next steps, and workspace shortcuts',
};

export default function HubPage() {
  return <SiteHub />;
}
