import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { SEASON_STATUS_LABELS, type SeasonDto } from '@porolympiques/shared';

/** Choix de la saison affichée (classement, events). */
@Component({
  selector: 'app-season-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (seasons().length > 1) {
      <select aria-label="Saison" class="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm" (change)="picked.emit($any($event.target).value)">
        @for (season of seasons(); track season.id) {
          <option [value]="season.id" [selected]="season.id === selected()">{{ season.name }} · {{ labels[season.status] }}</option>
        }
      </select>
    }
  `,
})
export class SeasonPicker {
  readonly seasons = input.required<SeasonDto[]>();
  readonly selected = input<string | null>(null);
  readonly picked = output<string>();
  protected readonly labels = SEASON_STATUS_LABELS;
}

/** Saison affichée par défaut : celle en cours, sinon la plus récente (la liste arrive de la plus récente à la plus ancienne). */
export function defaultSeason(seasons: SeasonDto[]): SeasonDto | null {
  return seasons.find((season) => season.status === 'active') ?? seasons[0] ?? null;
}
