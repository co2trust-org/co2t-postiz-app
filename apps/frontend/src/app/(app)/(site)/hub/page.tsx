import { Metadata } from 'next';
import { SiteHub } from '@gitroom/frontend/components/hub/site.hub';

export const metadata: Metadata = {
  title: 'Postiz - Home',
  description: 'Postiz workspace hub',
};

export default function HubPage() {
  return <SiteHub />;
}
