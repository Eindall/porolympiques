import type { DataSource } from 'typeorm';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('répond ok quand la base répond', async () => {
    const query = jest.fn().mockResolvedValue([{ '?column?': 1 }]);
    const controller = new HealthController({ query } as unknown as DataSource);

    await expect(controller.check()).resolves.toEqual({ status: 'ok' });
    expect(query).toHaveBeenCalledWith('SELECT 1');
  });

  it('échoue quand la base ne répond pas', async () => {
    const query = jest.fn().mockRejectedValue(new Error('connexion refusée'));
    const controller = new HealthController({ query } as unknown as DataSource);

    await expect(controller.check()).rejects.toThrow('connexion refusée');
  });
});
