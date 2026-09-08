import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Protects a route behind a valid JWT — i.e. reserves it for the
 * authenticated administrator. There is a single admin account (see
 * CLAUDE.md §7), so any request that passes this guard is the admin.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
