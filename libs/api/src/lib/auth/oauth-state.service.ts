import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { OAUTH_STATE_MAX_AGE_MS } from './session.constants';

const PURPOSE = 'oauth-state';

/**
 * Signe et vérifie le cookie du flux OAuth, qui garde le `state` anti-CSRF. Signé avec la même clé que les
 * sessions, mais avec un `purpose` différent : l'un ne peut pas passer pour l'autre.
 */
@Injectable()
export class OAuthStateService {
  constructor(private readonly jwt: JwtService) {}

  sign(state: string): Promise<string> {
    return this.jwt.signAsync({ state, purpose: PURPOSE }, { expiresIn: OAUTH_STATE_MAX_AGE_MS / 1000 });
  }

  /** Le state contenu dans le cookie, ou `null` si le cookie manque, a expiré ou n'est pas un cookie de state. */
  async verify(token: string | undefined): Promise<string | null> {
    if (!token) return null;
    try {
      const payload = await this.jwt.verifyAsync<{ state?: string; purpose?: string }>(token);
      return payload.purpose === PURPOSE && payload.state ? payload.state : null;
    } catch {
      return null;
    }
  }
}
