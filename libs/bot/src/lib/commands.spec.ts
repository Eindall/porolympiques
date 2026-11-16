import { commandDefinitions } from './commands';
import { parseGameChoice } from './interactions';

describe('commandes du bot', () => {
  it('déclare les six commandes, en français, dans les limites de Discord', () => {
    const commands = commandDefinitions();

    expect(commands.map((command) => command.name)).toEqual(['leaderboard', 'event', 'join', 'list-games', 'add-game', 'profile']);
    for (const command of commands) {
      expect(command.name).toMatch(/^[a-z-]{1,32}$/);
      expect(command.description.length).toBeLessThanOrEqual(100);
      for (const option of command.options ?? []) expect(option.description.length).toBeLessThanOrEqual(100);
    }
    const addGame = commands.find((command) => command.name === 'add-game');
    expect(addGame?.options?.filter((option) => 'required' in option && option.required).map((option) => option.name)).toEqual(['jeu', 'format', 'equipe', 'mode']);
  });

  it('lit le jeu choisi : enregistré, du catalogue, ou saisi librement', () => {
    expect(parseGameChoice('g:0d2f')).toEqual({ kind: 'existing', gameId: '0d2f' });
    expect(parseGameChoice('x:1942')).toEqual({ kind: 'catalog', externalId: '1942' });
    expect(parseGameChoice('c:Jeu maison')).toEqual({ kind: 'custom', name: 'Jeu maison' });
    expect(parseGameChoice('Tapé sans choisir')).toEqual({ kind: 'custom', name: 'Tapé sans choisir' });
  });
});
