import { InMemorySeasons, season } from '../events/test-helpers';
import { DEFAULT_SCORING_SCALE } from './season';
import { SeasonsService } from './seasons.service';

const admin = { id: 'p-admin', role: 'admin' as const };
const alice = { id: 'p-alice', role: 'player' as const };

const input = { name: '  Saison   2 ', startDate: new Date('2026-07-01T00:00:00Z'), endDate: new Date('2027-01-01T00:00:00Z') };

describe('SeasonsService', () => {
  it('crée une saison à venir avec le barème et les quotas par défaut', async () => {
    const service = new SeasonsService(new InMemorySeasons());

    const created = await service.create(admin, input);

    expect(created).toMatchObject({ name: 'Saison 2', status: 'upcoming', scoringScale: DEFAULT_SCORING_SCALE, mainQuota: 3, sideQuota: 2 });
  });

  it('réserve la gestion des saisons à l’admin', async () => {
    const service = new SeasonsService(new InMemorySeasons([season()]));

    await expect(service.create(alice, input)).rejects.toMatchObject({ code: 'forbidden' });
    await expect(service.update(alice, 's-1', { name: 'X' })).rejects.toMatchObject({ code: 'forbidden' });
    await expect(service.finish(alice, 's-1')).rejects.toMatchObject({ code: 'forbidden' });
  });

  it('refuse des dates dans le désordre, un barème à trou ou des quotas négatifs', async () => {
    const service = new SeasonsService(new InMemorySeasons());

    await expect(service.create(admin, { ...input, endDate: input.startDate })).rejects.toMatchObject({ code: 'invalid' });
    await expect(service.create(admin, { ...input, scoringScale: { 1: 10, 3: 5 } })).rejects.toMatchObject({ code: 'invalid' });
    await expect(service.create(admin, { ...input, mainQuota: -1 })).rejects.toMatchObject({ code: 'invalid' });
    await expect(service.create(admin, { ...input, name: '  ' })).rejects.toMatchObject({ code: 'invalid' });
  });

  it('modifie le barème et les quotas en vérifiant la saison complète', async () => {
    const service = new SeasonsService(new InMemorySeasons([season()]));

    expect(await service.update(admin, 's-1', { mainQuota: 4, scoringScale: { 1: 10, 2: 5 } })).toMatchObject({ mainQuota: 4, scoringScale: { 1: 10, 2: 5 } });
    await expect(service.update(admin, 's-1', { endDate: new Date('2025-01-01T00:00:00Z') })).rejects.toMatchObject({ code: 'invalid' });
  });

  it('démarre une saison à venir seulement si aucune n’est en cours, puis la termine', async () => {
    const seasons = new InMemorySeasons([season(), season({ id: 's-2', name: 'Saison 2', status: 'upcoming' })]);
    const service = new SeasonsService(seasons);

    await expect(service.start(admin, 's-2')).rejects.toMatchObject({ code: 'conflict' });
    await service.finish(admin, 's-1');
    expect(await service.start(admin, 's-2')).toMatchObject({ status: 'active' });
    await expect(service.start(admin, 's-1')).rejects.toMatchObject({ code: 'conflict' });
    await expect(service.finish(admin, 's-1')).rejects.toMatchObject({ code: 'conflict' });
  });

  it('liste les saisons, les plus récentes d’abord', async () => {
    const service = new SeasonsService(
      new InMemorySeasons([season(), season({ id: 's-2', startDate: new Date('2026-07-01T00:00:00Z'), status: 'upcoming' })]),
    );

    expect((await service.list()).map((s) => s.id)).toEqual(['s-2', 's-1']);
  });
});
