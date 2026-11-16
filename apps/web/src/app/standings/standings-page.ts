import { ChangeDetectionStrategy, Component, inject, type OnInit, signal } from '@angular/core';
import type { SeasonDto, SeasonStandingsDto } from '@porolympiques/shared';
import { formatParisDate } from '../core/paris-time';
import { SeasonPicker, defaultSeason } from '../core/season-picker';
import { EventsApi } from '../events/events.api';
import { errorMessage } from '../ideas/ideas.api';
import { StandingsTable } from './standings-table';

/** Classement d'une saison : la saison en cours par défaut, avec le détail des résultats comptés et écartés. */
@Component({
  selector: 'app-standings-page',
  imports: [SeasonPicker, StandingsTable],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="mx-auto flex max-w-4xl flex-col gap-5 px-4 py-8">
      <div class="flex flex-wrap items-end justify-between gap-3">
        <h1 class="text-3xl font-bold tracking-tight">Classement</h1>
        <app-season-picker [seasons]="seasons()" [selected]="standings()?.season?.id ?? null" (picked)="load($event)" />
      </div>
      @if (error()) {
        <p role="alert" class="rounded-lg bg-red-50 px-4 py-3 text-red-800">{{ error() }}</p>
      } @else if (standings(); as s) {
        <p class="text-sm text-slate-600">
          {{ s.season.name }} · du {{ day(s.season.startDate) }} au {{ day(s.season.endDate) }} ·
          les {{ s.season.mainQuota }} meilleurs mains et les {{ s.season.sideQuota }} meilleurs sides comptent.
          Les résultats écartés sont grisés.
        </p>
        @if (s.entries.length === 0) {
          <p class="rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center text-slate-600">Aucun résultat pour l’instant.</p>
        } @else {
          <app-standings-table [entries]="s.entries" [detailed]="true" />
        }
      } @else if (loaded()) {
        <p class="text-slate-600">Aucune saison pour l’instant.</p>
      }
    </main>
  `,
})
export class StandingsPage implements OnInit {
  private readonly api = inject(EventsApi);

  protected readonly seasons = signal<SeasonDto[]>([]);
  protected readonly standings = signal<SeasonStandingsDto | null>(null);
  protected readonly loaded = signal(false);
  protected readonly error = signal('');
  protected readonly day = formatParisDate;

  async ngOnInit(): Promise<void> {
    try {
      const seasons = await this.api.seasons();
      this.seasons.set(seasons);
      const season = defaultSeason(seasons);
      if (season) await this.load(season.id);
    } catch (error) {
      this.error.set(errorMessage(error));
    } finally {
      this.loaded.set(true);
    }
  }

  async load(seasonId: string): Promise<void> {
    this.error.set('');
    try {
      this.standings.set(await this.api.standings(seasonId));
    } catch (error) {
      this.error.set(errorMessage(error));
    }
  }
}
