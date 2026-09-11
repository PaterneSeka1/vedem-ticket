import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

/**
 * Les services renvoient les documents Mongo tels que le contract Prisma les
 * lit (`_id`, ObjectId natif) — pratique côté back, mais ce n'est pas ce
 * qu'une API REST doit exposer : le frontend (et Swagger) attendent un champ
 * `id` classique. Plutôt que de réécrire chaque service pour mapper `_id` ->
 * `id` à la main (source d'oublis), cet interceptor global le fait une seule
 * fois, juste avant sérialisation JSON, sur toute réponse (objet, tableau,
 * objet imbriqué comme `{ order, tickets }`).
 *
 * Ne touche qu'aux objets "plain" (littéraux) : un ObjectId ou une Date
 * gardent leur valeur telle quelle (leur propre `toJSON()` s'occupe du
 * formatage final), seule la clé `_id` est renommée.
 */
export function normalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => normalize(item));
  }
  if (value && typeof value === 'object' && (value as object).constructor === Object) {
    const result: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
      result[key === '_id' ? 'id' : key] = normalize(v);
    }
    return result;
  }
  return value;
}

@Injectable()
export class IdNormalizeInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(map((data: unknown) => normalize(data)));
  }
}
