import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare } from 'bcryptjs';
import { db } from '../prisma/db.js';

export interface AdminProfile {
  id: string;
  username: string;
}

export interface LoginResult {
  accessToken: string;
  admin: AdminProfile;
}

@Injectable()
export class AuthService {
  constructor(private readonly jwtService: JwtService) {}

  /**
   * Vérifie les identifiants contre l'unique compte administrateur.
   * Retourne le profil admin si valides, sinon `null`.
   */
  async validateAdmin(username: string, password: string): Promise<AdminProfile | null> {
    const user = await db.orm.users.where({ username }).first();
    if (!user) {
      return null;
    }

    const passwordMatches = await compare(password, user.password);
    if (!passwordMatches) {
      return null;
    }

    return { id: user._id.toString(), username: user.username };
  }

  async login(username: string, password: string): Promise<LoginResult> {
    const admin = await this.validateAdmin(username, password);
    if (!admin) {
      throw new UnauthorizedException('Identifiants invalides');
    }

    const accessToken = await this.jwtService.signAsync({
      sub: admin.id,
      username: admin.username,
    });

    return { accessToken, admin };
  }
}
