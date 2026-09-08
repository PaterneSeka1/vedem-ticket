import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable, Type, mixin } from '@nestjs/common';
import type { Request } from 'express';

interface Bucket {
  count: number;
  resetAt: number;
}

/**
 * Limiteur de débit minimal, en mémoire, par IP + route. Suffisant pour un
 * déploiement mono-instance ; ne partage pas l'état entre plusieurs instances
 * (pas de Redis ici) — à revoir si le backend est un jour scalé
 * horizontalement.
 *
 * Utilisation : `@UseGuards(RateLimit(10, 5 * 60_000))` (10 requêtes / 5 min).
 */
export function RateLimit(limit: number, windowMs: number): Type<CanActivate> {
  const buckets = new Map<string, Bucket>();

  @Injectable()
  class RateLimitGuard implements CanActivate {
    canActivate(context: ExecutionContext): boolean {
      const req = context.switchToHttp().getRequest<Request>();
      const key = `${req.method}:${req.route?.path ?? req.path}:${req.ip}`;
      const now = Date.now();

      const bucket = buckets.get(key);
      if (!bucket || bucket.resetAt <= now) {
        buckets.set(key, { count: 1, resetAt: now + windowMs });
        return true;
      }

      if (bucket.count >= limit) {
        throw new HttpException('Trop de requêtes, réessayez plus tard.', HttpStatus.TOO_MANY_REQUESTS);
      }

      bucket.count += 1;
      return true;
    }
  }

  return mixin(RateLimitGuard);
}
