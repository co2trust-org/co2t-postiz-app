/**
 * Concatenate server-side org marketing brief with operator-built agent sidebar context.
 * Character budgets preserve room for sidebar notes/tools output.
 */

import { formatBrandBrainForPrompt } from './brand.brain.shared';
import type { MarketingContextDocumentV1 } from './marketing.context';
import { PlanningDefinitionsV1 } from './marketing.context';

const MAX_SERVER_MERGED_CHARS = 6000;

function formatPlanningForPrompt(
  bb: MarketingContextDocumentV1['brandBrain'],
  planning: PlanningDefinitionsV1
): string {
  const lines: string[] = ['### Org planning definitions'];
  lines.push(`- Default horizon preference: ${planning.horizonDaysDefault} days`);
  if (planning.campaignTheme?.trim()) {
    lines.push(`- Campaign / theme focus: ${planning.campaignTheme.trim()}`);
  }
  if (typeof planning.targetPostsPerWeek === 'number') {
    lines.push(`- Target posts per week (team goal): ${planning.targetPostsPerWeek}`);
  }
  const focus =
    planning.focusConceptIds?.map((id) => bb.concepts.find((c) => c.id === id)) ??
    [];
  const labels = focus
    .filter((c): c is NonNullable<(typeof focus)[number]> => !!c)
    .map((c) => `"${c.label}" (${c.kind})`);
  if (labels.length) {
    lines.push(`- Focus concepts: ${labels.join('; ')}`);
  }
  if (planning.notes?.trim()) {
    lines.push(`- Planner notes:\n${planning.notes.trim()}`);
  }
  return lines.join('\n');
}

/**
 * Builds the server-injected markdown block + optional appended brand brain + planning sections.
 */
export function buildMergedAgentContextWithOrgMarketing(opts: {
  operatorSidebarContext: string;
  doc: MarketingContextDocumentV1 | null;
}): string {
  const { operatorSidebarContext, doc } = opts;
  const sidebar = typeof operatorSidebarContext === 'string' ? operatorSidebarContext : '';
  if (!doc) {
    return sidebar.slice(0, 14000);
  }

  let serverBlock =
    '[--org-marketing-context--]\n' +
    formatPlanningForPrompt(doc.brandBrain, doc.planning) +
    '\n\n';

  serverBlock += formatBrandBrainForPrompt(doc.brandBrain);

  if (serverBlock.length > MAX_SERVER_MERGED_CHARS) {
    serverBlock = serverBlock.slice(0, MAX_SERVER_MERGED_CHARS) + '\n…(truncated)';
  }

  const combined = `${serverBlock}\n\n${sidebar}`.trim();
  return combined.slice(0, 14000);
}
