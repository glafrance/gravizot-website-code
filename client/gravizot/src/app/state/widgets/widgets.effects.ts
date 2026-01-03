// src/app/state/widgets/widgets.effects.ts
import { inject, Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { widgetsActions } from './widgets.feature';
import { of } from 'rxjs';
import { catchError, delay, map, switchMap } from 'rxjs/operators';

@Injectable()
export class WidgetsEffects {
  private actions$ = inject(Actions);

  // Simulate loading from server
  load$ = createEffect(() =>
    this.actions$.pipe(
      ofType(widgetsActions.load),
      switchMap(() =>
        of([
          { id: 'w1', name: 'Analytics' },
          { id: 'w2', name: 'Revenue' },
          { id: 'w3', name: 'Traffic' },
        ]).pipe(
          delay(400),
          map((widgets) => widgetsActions.loadSuccess({ widgets })),
          catchError((e) => of(widgetsActions.loadFailure({ error: String(e?.message ?? e) })))
        )
      )
    )
  );
}
