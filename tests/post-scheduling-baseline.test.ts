import {
  getMissingQueuePostsPublishDateWindowUtc,
  orchestratorGetPostsListBlockedBySubscription,
} from '@gitroom/nestjs-libraries/scheduling/post-orchestrator-rules';

/**
 * Baseline semantics aligned with gitroomhq/postiz-app `main` (see docs in post-orchestrator-rules.ts).
 * If scheduled posting regresses, these tests should fail or need an intentional update.
 */
describe('post scheduling baseline (upstream Postiz main)', () => {
  describe('getMissingQueuePostsPublishDateWindowUtc', () => {
    it('uses UTC now − 2h .. now + 2h (symmetric window)', () => {
      const now = new Date('2026-05-08T12:00:00.000Z');
      const { gte, lt } = getMissingQueuePostsPublishDateWindowUtc(now);
      expect(gte.toISOString()).toBe('2026-05-08T10:00:00.000Z');
      expect(lt.toISOString()).toBe('2026-05-08T14:00:00.000Z');
    });

    it('documents: a QUEUE post due 3h ago is outside the recovery window (not selected)', () => {
      const now = new Date('2026-05-08T12:00:00.000Z');
      const dueThreeHoursAgo = new Date('2026-05-08T09:00:00.000Z');
      const { gte } = getMissingQueuePostsPublishDateWindowUtc(now);
      expect(dueThreeHoursAgo.getTime()).toBeLessThan(gte.getTime());
    });
  });

  describe('orchestratorGetPostsListBlockedBySubscription', () => {
    it('does not block when Stripe is not configured', () => {
      expect(
        orchestratorGetPostsListBlockedBySubscription(false, null)
      ).toBe(false);
      expect(
        orchestratorGetPostsListBlockedBySubscription(false, { id: 'sub' })
      ).toBe(false);
    });

    it('blocks when Stripe is configured and there is no subscription (workflow sees empty list)', () => {
      expect(
        orchestratorGetPostsListBlockedBySubscription(true, null)
      ).toBe(true);
      expect(
        orchestratorGetPostsListBlockedBySubscription(true, undefined)
      ).toBe(true);
    });

    it('does not block when Stripe is configured and a subscription exists', () => {
      expect(
        orchestratorGetPostsListBlockedBySubscription(true, { id: 'sub_1' })
      ).toBe(false);
    });
  });
});
