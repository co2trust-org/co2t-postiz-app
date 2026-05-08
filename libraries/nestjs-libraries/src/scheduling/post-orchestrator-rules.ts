import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';

dayjs.extend(utc);

/**
 * UTC publishDate bounds for `searchForMissingThreeHoursPosts` (QUEUE recovery).
 * Matches gitroomhq/postiz-app `PostsRepository.searchForMissingThreeHoursPosts` on main:
 * a ±2 hour window around "now", not a trailing 3-hour backlog window.
 */
export function getMissingQueuePostsPublishDateWindowUtc(now: Date = new Date()) {
  const utcNow = dayjs.utc(now);
  return {
    gte: utcNow.subtract(2, 'hour').toDate(),
    lt: utcNow.add(2, 'hour').toDate(),
  };
}

/** True when the orchestrator must skip loading post rows (empty list → workflow no-ops). */
export function orchestratorGetPostsListBlockedBySubscription(
  stripeSecretKeySet: boolean,
  subscription: unknown | null | undefined
): boolean {
  if (!stripeSecretKeySet) {
    return false;
  }
  return !subscription;
}
