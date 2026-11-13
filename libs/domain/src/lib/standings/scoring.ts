import type { ScoringScale } from '../seasons/season';

/** Erreurs d'un barème : les places vont de 1 à N sans trou, les points sont des nombres positifs ou nuls. */
export function scoringScaleErrors(scale: ScoringScale): string[] {
  const keys = Object.keys(scale);
  if (keys.length === 0) return ['le barème est vide'];
  const errors: string[] = [];
  const places = keys.map(Number).sort((a, b) => a - b);
  if (keys.some((key) => !/^[1-9]\d*$/.test(key))) errors.push('les places doivent être des entiers à partir de 1');
  else if (places.some((place, index) => place !== index + 1)) errors.push('les places doivent se suivre à partir de 1');
  for (const key of keys) {
    const points = scale[key];
    if (typeof points !== 'number' || !Number.isFinite(points) || points < 0) {
      errors.push(`points invalides pour la place ${key}`);
    }
  }
  return errors;
}

export function assertScoringScale(scale: ScoringScale): void {
  const errors = scoringScaleErrors(scale);
  if (errors.length > 0) throw new Error(`Barème invalide : ${errors.join(', ')}`);
}

/**
 * Points d'un résultat, en centièmes de point (entiers, pour additionner et comparer sans erreur d'arrondi) :
 * `barème[place] × coefficient`, la dernière place du barème valant pour toutes les suivantes. Zéro si non classé.
 * Le barème doit avoir été vérifié (`assertScoringScale`).
 */
export function pointsInHundredths(scale: ScoringScale, place: number | null, coefficient: number): number {
  if (place === null) return 0;
  const lastPlace = Object.keys(scale).length;
  return Math.round(scale[String(Math.min(place, lastPlace))] * coefficient * 100);
}

export function pointsFor(scale: ScoringScale, place: number | null, coefficient: number): number {
  assertScoringScale(scale);
  return pointsInHundredths(scale, place, coefficient) / 100;
}
