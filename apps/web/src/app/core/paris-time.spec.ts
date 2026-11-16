import { formatParis, fromParisInput, toParisInput } from './paris-time';

describe('heure de Paris', () => {
  it('lit une saisie en heure de Paris, l’hiver comme l’été', () => {
    expect(fromParisInput('2026-02-02T18:00')).toBe('2026-02-02T17:00:00.000Z');
    expect(fromParisInput('2026-07-14T22:30')).toBe('2026-07-14T20:30:00.000Z');
    expect(fromParisInput('')).toBeNull();
  });

  it('remplit un champ en heure de Paris', () => {
    expect(toParisInput('2026-02-02T17:00:00.000Z')).toBe('2026-02-02T18:00');
    expect(toParisInput('2026-07-14T20:30:00.000Z')).toBe('2026-07-14T22:30');
    expect(toParisInput(null)).toBe('');
  });

  it('affiche en français, en heure de Paris', () => {
    expect(formatParis('2026-02-02T17:00:00.000Z')).toContain('18:00');
    expect(formatParis('2026-02-02T17:00:00.000Z')).toContain('févr.');
  });
});
