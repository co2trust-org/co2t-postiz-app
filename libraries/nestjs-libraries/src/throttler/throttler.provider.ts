import { ThrottlerGuard } from '@nestjs/throttler';
import { ExecutionContext, Injectable } from '@nestjs/common';
import { Request } from 'express';

@Injectable()
export class ThrottlerBehindProxyGuard extends ThrottlerGuard {
  public override async canActivate(
    context: ExecutionContext
  ): Promise<boolean> {
    const { url, method } = context.switchToHttp().getRequest<Request>();
    if (method === 'POST' && url.includes('/public/v1/posts')) {
      return super.canActivate(context);
    }

    return true;
  }

  protected override async getTracker(
    req: Record<string, any>
  ): Promise<string> {
    const orgId = req.org?.id;
    if (!orgId) {
      return req.ip || req.socket?.remoteAddress || 'anonymous';
    }
    return (
      orgId + '_' + (req.url.indexOf('/posts') > -1 ? 'posts' : 'other')
    );
  }
}
