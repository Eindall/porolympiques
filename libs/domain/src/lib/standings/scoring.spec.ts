import { DEFAULT_SCORING_SCALE } from '../seasons/season';
import { pointsFor, scoringScaleErrors } from './scoring';

describe('pointsFor', () => {
  it.each([
    [1, 24],
    [2, 18],
    [3, 14],
    [4, 12],
    [5, 10],
    [6, 8],
    [7, 6],
    [8, 4],
    [9, 2],
  ])('main : place %i → %i points', (place, points) => {
    expect(pointsFor(DEFAULT_SCORING_SCALE, place, 1)).toBe(points);
  });

  it('applique le coefficient : un side compte moitié moins', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9].map((place) => pointsFor(DEFAULT_SCORING_SCALE, place, 0.5))).toEqual([
      12, 9, 7, 6, 5, 4, 3, 2, 1,
    ]);
  });

  it('donne les points de la dernière place du barème à toutes les places suivantes', () => {
    expect(pointsFor(DEFAULT_SCORING_SCALE, 10, 1)).toBe(2);
    expect(pointsFor(DEFAULT_SCORING_SCALE, 42, 0.5)).toBe(1);
  });

  it('donne zéro point à un non classé', () => {
    expect(pointsFor(DEFAULT_SCORING_SCALE, null, 1)).toBe(0);
  });

  it('suit un barème modifié et un coefficient quelconque, sans erreur d’arrondi', () => {
    expect(pointsFor({ 1: 10, 2: 5 }, 1, 0.3)).toBe(3);
    expect(pointsFor({ 1: 10, 2: 5 }, 3, 1.5)).toBe(7.5);
  });

  it('refuse un barème invalide', () => {
    expect(() => pointsFor({ 1: 10, 3: 5 }, 1, 1)).toThrow('Barème invalide');
  });
});

describe('scoringScaleErrors', () => {
  it('accepte le barème par défaut', () => {
    expect(scoringScaleErrors(DEFAULT_SCORING_SCALE)).toEqual([]);
  });

  it.each([
    ['vide', {}],
    ['places qui ne commencent pas à 1', { 2: 10 }],
    ['places avec un trou', { 1: 10, 3: 5 }],
    ['place non entière', { 1: 10, '1.5': 5 }],
    ['place zéro', { 0: 10, 1: 5 }],
    ['points négatifs', { 1: -1 }],
    ['points non numériques', { 1: '10' as unknown as number }],
  ])('refuse un barème : %s', (_case, scale) => {
    expect(scoringScaleErrors(scale)).not.toEqual([]);
  });
});
