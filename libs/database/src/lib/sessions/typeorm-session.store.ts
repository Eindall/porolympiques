import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { SessionStore, StoredSession } from '@porolympiques/domain';
import { DataSource, IsNull, Repository } from 'typeorm';
import { AuthSessionEntity } from './auth-session.entity';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function toSession(row: AuthSessionEntity): StoredSession {
  return {
    id: row.id,
    playerId: row.playerId,
    createdAt: row.createdAt,
    lastUsedAt: row.lastUsedAt,
    expiresAt: row.expiresAt,
    revokedAt: row.revokedAt,
  };
}

@Injectable()
export class TypeOrmSessionStore implements SessionStore {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(AuthSessionEntity) private readonly rows: Repository<AuthSessionEntity>,
  ) {}

  async create(input: { playerId: string; userAgent: string | null; now: Date; expiresAt: Date }): Promise<StoredSession> {
    const row = await this.rows.save(
      this.rows.create({
        playerId: input.playerId,
        userAgent: input.userAgent ? input.userAgent.slice(0, 256) : null,
        createdAt: input.now,
        lastUsedAt: input.now,
        expiresAt: input.expiresAt,
      }),
    );
    return toSession(row);
  }

  async findById(id: string): Promise<StoredSession | null> {
    if (!UUID.test(id)) return null;
    const row = await this.rows.findOneBy({ id });
    return row ? toSession(row) : null;
  }

  /** Un seul UPDATE conditionnel : pas de lecture-écriture, pas de course entre requêtes concurrentes. */
  async touch(
    id: string,
    now: Date,
    rules: { idleTtlMs: number; absoluteMaxMs: number; minIntervalMs: number },
  ): Promise<Date | null> {
    const [rows] = (await this.dataSource.query(
      `UPDATE auth_sessions
       SET last_used_at = $2,
           expires_at = LEAST($2::timestamptz + $3::double precision * interval '1 millisecond',
                              created_at + $4::double precision * interval '1 millisecond')
       WHERE id = $1 AND revoked_at IS NULL
         AND last_used_at <= $2::timestamptz - $5::double precision * interval '1 millisecond'
       RETURNING expires_at`,
      [id, now, rules.idleTtlMs, rules.absoluteMaxMs, rules.minIntervalMs],
    )) as [Array<{ expires_at: Date }>, number];
    return rows[0]?.expires_at ?? null;
  }

  async revoke(id: string, playerId: string, now: Date): Promise<void> {
    if (!UUID.test(id)) return;
    await this.rows.update({ id, playerId, revokedAt: IsNull() }, { revokedAt: now });
  }

  async revokeAllForPlayer(playerId: string, now: Date): Promise<number> {
    const result = await this.rows.update({ playerId, revokedAt: IsNull() }, { revokedAt: now });
    return result.affected ?? 0;
  }

  async revokeBeyondLimit(playerId: string, max: number, now: Date): Promise<void> {
    await this.dataSource.query(
      `UPDATE auth_sessions SET revoked_at = $2
       WHERE id IN (
         SELECT id FROM auth_sessions
         WHERE player_id = $1 AND revoked_at IS NULL AND expires_at > $2
         ORDER BY created_at DESC, id OFFSET $3
       )`,
      [playerId, now, max],
    );
  }

  async deleteStale(now: Date, revokedBefore: Date): Promise<number> {
    const result = await this.rows
      .createQueryBuilder()
      .delete()
      .where('expires_at <= :now OR revoked_at <= :revokedBefore', { now, revokedBefore })
      .execute();
    return result.affected ?? 0;
  }
}
