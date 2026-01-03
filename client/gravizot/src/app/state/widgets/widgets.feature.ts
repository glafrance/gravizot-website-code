// src/app/state/widgets/widgets.feature.ts
import { createActionGroup, emptyProps, props } from '@ngrx/store';
import { createFeature, createReducer, on } from '@ngrx/store';
import { createEntityAdapter, EntityState } from '@ngrx/entity';

export type Widget = { id: string; name: string };

export interface WidgetsState extends EntityState<Widget> {
  loading: boolean;
  error: string | null;
}

export const widgetsActions = createActionGroup({
  source: 'Widgets',
  events: {
    'Load': emptyProps(),
    'Load Success': props<{ widgets: Widget[] }>(),
    'Load Failure': props<{ error: string }>(),
    'Add': props<{ widget: Widget }>(),
    'Remove': props<{ id: string }>(),
    'Rename': props<{ id: string; name: string }>(),
  },
});

const adapter = createEntityAdapter<Widget>({
  selectId: (w) => w.id,
  sortComparer: (a, b) => a.name.localeCompare(b.name),
});

const initialState: WidgetsState = adapter.getInitialState({
  loading: false,
  error: null,
});

const reducer = createReducer(
  initialState,
  on(widgetsActions.load, (state) => ({ ...state, loading: true, error: null })),
  on(widgetsActions.loadSuccess, (state, { widgets }) =>
    adapter.setAll(widgets, { ...state, loading: false })),
  on(widgetsActions.loadFailure, (state, { error }) => ({ ...state, loading: false, error })),
  on(widgetsActions.add, (state, { widget }) => adapter.addOne(widget, state)),
  on(widgetsActions.remove, (state, { id }) => adapter.removeOne(id, state)),
  on(widgetsActions.rename, (state, { id, name }) =>
    adapter.updateOne({ id, changes: { name } }, state)),
);

// createFeature gives you a feature selector + handy child selectors.
// We also expose bound entity selectors via extraSelectors.
export const widgetsFeature = createFeature({
  name: 'widgets',
  reducer,
  extraSelectors: ({ selectWidgetsState }) => {
    const bound = adapter.getSelectors(selectWidgetsState);
    return {
      selectAllWidgets: bound.selectAll,
      selectWidgetEntities: bound.selectEntities,
      selectTotalWidgets: bound.selectTotal,
      selectLoading: (s: any) => selectWidgetsState(s).loading,
      selectError: (s: any) => selectWidgetsState(s).error,
    };
  },
});
