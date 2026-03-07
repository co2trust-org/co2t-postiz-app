import { NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const resolveBackendInternalUrl = () => {
  const fallback = 'http://localhost:3000';
  const configured = process.env.BACKEND_INTERNAL_URL || fallback;

  try {
    const configuredUrl = new URL(configured);
    const frontendUrl = process.env.FRONTEND_URL
      ? new URL(process.env.FRONTEND_URL)
      : null;

    if (frontendUrl && configuredUrl.host === frontendUrl.host) {
      return fallback;
    }

    return configured;
  } catch {
    return fallback;
  }
};

const joinUrl = (base: string, path: string) => {
  const normalizedBase = base.endsWith('/') ? base.slice(0, -1) : base;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${normalizedBase}${normalizedPath}`;
};

async function proxyRequest(
  request: NextRequest,
  params: { path?: string[] }
): Promise<Response> {
  const path = (params.path || []).join('/');
  const backendBase = resolveBackendInternalUrl();
  const targetUrl = new URL(joinUrl(backendBase, path));
  targetUrl.search = request.nextUrl.search;

  const requestHeaders = new Headers(request.headers);
  requestHeaders.delete('host');
  requestHeaders.delete('content-length');

  const method = request.method.toUpperCase();
  const shouldSendBody = method !== 'GET' && method !== 'HEAD';
  const requestBody = shouldSendBody ? await request.arrayBuffer() : undefined;

  const upstreamResponse = await fetch(targetUrl.toString(), {
    method,
    headers: requestHeaders,
    body:
      requestBody && requestBody.byteLength > 0 ? requestBody : undefined,
    redirect: 'manual',
    cache: 'no-store',
  });

  const responseHeaders = new Headers(upstreamResponse.headers);
  return new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    statusText: upstreamResponse.statusText,
    headers: responseHeaders,
  });
}

export async function GET(
  request: NextRequest,
  context: { params: { path?: string[] } }
) {
  return proxyRequest(request, context.params);
}

export async function POST(
  request: NextRequest,
  context: { params: { path?: string[] } }
) {
  return proxyRequest(request, context.params);
}

export async function PUT(
  request: NextRequest,
  context: { params: { path?: string[] } }
) {
  return proxyRequest(request, context.params);
}

export async function PATCH(
  request: NextRequest,
  context: { params: { path?: string[] } }
) {
  return proxyRequest(request, context.params);
}

export async function DELETE(
  request: NextRequest,
  context: { params: { path?: string[] } }
) {
  return proxyRequest(request, context.params);
}

export async function OPTIONS(
  request: NextRequest,
  context: { params: { path?: string[] } }
) {
  return proxyRequest(request, context.params);
}
