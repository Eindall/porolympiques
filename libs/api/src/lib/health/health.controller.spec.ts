import type { DataSource } from 'typeorm';
import { HealthController } from './health.controller';

const bot = (connected: boolean) => ({ isConnected: () => connected });

describe('HealthController', () => {
  it('répond ok quand la base répond, avec l’état du bot', async () => {
    const query = jest.fn().mockResolvedValue([{ '?column?': 1 }]);

    await expect(new HealthController({ query } as unknown as DataSource, bot(true)).check()).resolves.toEqual({ status: 'ok', discord: 'up' });
    await expect(new HealthController({ query } as unknown as DataSource, bot(false)).check()).resolves.toEqual({ status: 'ok', discord: 'down' });
    expect(query).toHaveBeenCalledWith('SELECT 1');
  });

  it('échoue quand la base ne répond pas', async () => {
    const query = jest.fn().mockRejectedValue(new Error('connexion refusée'));
    const controller = new HealthController({ query } as unknown as DataSource, bot(true));

    await expect(controller.check()).rejects.toThrow('connexion refusée');
  });
});
