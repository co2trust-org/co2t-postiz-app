import { NextResponse } from 'next/server';

const firstNonEmpty = (values: Array<string | undefined>) =>
  values.find((value) => typeof value === 'string' && value.trim().length > 0);

export async function GET() {
  const branch =
    firstNonEmpty([
      process.env.RAILWAY_GIT_BRANCH,
      process.env.VERCEL_GIT_COMMIT_REF,
      process.env.GITHUB_HEAD_REF,
      process.env.GITHUB_REF_NAME,
      process.env.CI_COMMIT_REF_NAME,
      process.env.BRANCH,
      process.env.SOURCE_BRANCH,
      process.env.NEXT_PUBLIC_GIT_BRANCH,
    ]) || 'local';

  const release =
    firstNonEmpty([
      process.env.RAILWAY_GIT_COMMIT_SHA,
      process.env.VERCEL_GIT_COMMIT_SHA,
      process.env.GITHUB_SHA,
      process.env.CI_COMMIT_SHA,
      process.env.COMMIT_SHA,
      process.env.SOURCE_COMMIT,
      process.env.NEXT_PUBLIC_GIT_RELEASE,
      process.env.NEXT_PUBLIC_VERSION,
      process.env.RAILWAY_DEPLOYMENT_ID,
    ]) || 'local';

  return NextResponse.json(
    {
      branch,
      release,
    },
    {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    }
  );
}
