import { Injectable, Logger } from '@nestjs/common';
import { ProductsRepository } from '@gitroom/nestjs-libraries/database/prisma/products/products.repository';

const DEFAULT_TIMEOUT_MS = 25_000;
const MAX_RESPONSE_BYTES = 2_000_000;

const DEFAULT_ALLOWLIST = [
  'main-api-development.up.railway.app',
  'test.co2t.earth',
  'postiz.co2t.earth',
];

function parseAllowlist(): string[] {
  const extra = process.env.ASSISTANT_HTTP_ALLOWLIST_HOSTS;
  if (!extra?.trim()) {
    return DEFAULT_ALLOWLIST;
  }
  return [
    ...DEFAULT_ALLOWLIST,
    ...extra.split(',').map((h) => h.trim().toLowerCase()).filter(Boolean),
  ];
}

@Injectable()
export class AssistantHttpService {
  private readonly _log = new Logger(AssistantHttpService.name);

  constructor(private _productsRepo: ProductsRepository) {}

  private allowedHosts() {
    return parseAllowlist();
  }

  isUrlAllowed(urlStr: string): { ok: true; url: URL } | { ok: false; reason: string } {
    let url: URL;
    try {
      url = new URL(urlStr);
    } catch {
      return { ok: false, reason: 'invalid_url' };
    }
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      return { ok: false, reason: 'invalid_protocol' };
    }
    const host = url.hostname.toLowerCase();
    if (!this.allowedHosts().includes(host)) {
      return { ok: false, reason: `host_not_allowlisted:${host}` };
    }
    return { ok: true, url };
  }

  async executeForOrg(
    organizationId: string,
    input: {
      method: 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'PUT';
      url: string;
      headers?: Record<string, string>;
      query?: Record<string, string | number | boolean | undefined>;
      body?: unknown;
    }
  ): Promise<{
    status: number;
    headers: Record<string, string>;
    data: unknown;
  }> {
    const check = this.isUrlAllowed(input.url);
    if (check.ok === false) {
      await this._productsRepo.createAuditLog({
        organizationId,
        method: input.method,
        url: input.url,
        status: null,
        durationMs: null,
        error: check.reason,
      });
      throw new Error(check.reason);
    }

    const url = check.url;
    if (input.query) {
      for (const [k, v] of Object.entries(input.query)) {
        if (v === undefined) continue;
        url.searchParams.set(k, String(v));
      }
    }

    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...(input.headers || {}),
    };

    const serviceToken = process.env.ASSISTANT_UPSTREAM_SERVICE_TOKEN;
    if (serviceToken && !headers.Authorization && !headers.authorization) {
      headers.Authorization = `Bearer ${serviceToken}`;
    }

    const co2t = process.env.CO2T_PRODUCTS_API_TOKEN;
    if (
      co2t &&
      url.hostname === 'main-api-development.up.railway.app' &&
      !headers.Authorization &&
      !headers.authorization
    ) {
      headers.Authorization = `Bearer ${co2t}`;
    }

    const init: RequestInit = {
      method: input.method,
      headers,
      signal: AbortSignal.timeout(
        Number(process.env.ASSISTANT_HTTP_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS
      ),
    };

    if (
      input.body !== undefined &&
      input.method !== 'GET' &&
      input.method !== 'DELETE'
    ) {
      init.body =
        typeof input.body === 'string'
          ? input.body
          : JSON.stringify(input.body);
      if (!headers['Content-Type'] && !headers['content-type']) {
        headers['Content-Type'] = 'application/json';
      }
    }

    const started = Date.now();
    let status = 0;
    try {
      const res = await fetch(url.toString(), init);
      status = res.status;
      const buf = await res.arrayBuffer();
      if (buf.byteLength > MAX_RESPONSE_BYTES) {
        throw new Error('response_too_large');
      }
      const text = new TextDecoder().decode(buf);
      let data: unknown = text;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        /* keep text */
      }
      const outHeaders: Record<string, string> = {};
      res.headers.forEach((v, k) => {
        outHeaders[k] = v;
      });
      await this._productsRepo.createAuditLog({
        organizationId,
        method: input.method,
        url: url.toString(),
        status,
        durationMs: Date.now() - started,
        error: null,
      });
      return { status, headers: outHeaders, data };
    } catch (e: any) {
      await this._productsRepo.createAuditLog({
        organizationId,
        method: input.method,
        url: url.toString(),
        status: status || null,
        durationMs: Date.now() - started,
        error: e?.message || String(e),
      });
      throw e;
    }
  }
}
