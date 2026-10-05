import { createFakeDispatch, dispatchedActions } from '../../util/testHelpers';
import reducer, {
  loadData,
  fetchExecutorsRequest,
  fetchExecutorsSuccess,
  fetchExecutorsError,
  serverDataReused,
} from './CategoryExecutorsPage.duck';

const executors = [{ id: 'u1', displayName: 'Мастер' }];

const stateWith = pageState => () => ({
  CategoryExecutorsPage: { ...reducer(undefined, {}), ...pageState },
});

describe('CategoryExecutorsPage duck', () => {
  beforeEach(() => {
    global.fetch = jest.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve({ data: executors }) })
    );
  });
  afterEach(() => {
    delete global.fetch;
  });

  it('loads the executors of a known category', () => {
    const getState = stateWith({});
    const dispatch = createFakeDispatch(getState);

    return loadData({ categoryId: 'repairs_main' }, '', {})(dispatch, getState).then(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost/api/search-executors?category=repairs_main',
        {}
      );
      expect(dispatchedActions(dispatch)).toEqual([
        fetchExecutorsRequest('repairs_main'),
        fetchExecutorsSuccess('repairs_main', executors, false),
      ]);
    });
  });

  it('does not query an unknown category', () => {
    const getState = stateWith({});
    const dispatch = createFakeDispatch(getState);

    return loadData({ categoryId: 'no_such_category' }, '', {})(dispatch, getState).then(() => {
      expect(global.fetch).not.toHaveBeenCalled();
      expect(dispatchedActions(dispatch)).toEqual([]);
    });
  });

  it('reuses the list rendered on the server instead of fetching it again', () => {
    const getState = stateWith({
      categoryId: 'repairs_main',
      executors,
      executorsLoaded: true,
      loadedOnServer: true,
    });
    const dispatch = createFakeDispatch(getState);

    return loadData({ categoryId: 'repairs_main' }, '', {})(dispatch, getState).then(() => {
      expect(global.fetch).not.toHaveBeenCalled();
      expect(dispatchedActions(dispatch)).toEqual([serverDataReused()]);
    });
  });

  it('reports a failed request in the browser', () => {
    global.fetch = jest.fn(() => Promise.resolve({ ok: false, status: 429 }));
    const getState = stateWith({});
    const dispatch = createFakeDispatch(getState);

    return loadData({ categoryId: 'repairs_main' }, '', {})(dispatch, getState).then(() => {
      const actions = dispatchedActions(dispatch);
      expect(actions[0]).toEqual(fetchExecutorsRequest('repairs_main'));
      expect(actions[1].type).toEqual(fetchExecutorsError('repairs_main', null).type);
      expect(actions[1].payload.categoryId).toEqual('repairs_main');
    });
  });

  describe('reducer', () => {
    it('keeps the shown list while the same category reloads', () => {
      const loaded = reducer(
        reducer(undefined, fetchExecutorsRequest('repairs_main')),
        fetchExecutorsSuccess('repairs_main', executors, true)
      );
      const reloading = reducer(loaded, fetchExecutorsRequest('repairs_main'));

      expect(reloading.executors).toEqual(executors);
      expect(reloading.executorsLoaded).toBe(true);
      expect(reloading.loadedOnServer).toBe(false);
    });

    it('drops the previous list when another category opens', () => {
      const loaded = reducer(
        reducer(undefined, fetchExecutorsRequest('repairs_main')),
        fetchExecutorsSuccess('repairs_main', executors, false)
      );
      const other = reducer(loaded, fetchExecutorsRequest('Delivery'));

      expect(other.executors).toEqual([]);
      expect(other.executorsLoaded).toBe(false);
    });

    it('ignores a late answer for a category the visitor already left', () => {
      const switched = reducer(
        reducer(undefined, fetchExecutorsRequest('repairs_main')),
        fetchExecutorsRequest('Delivery')
      );
      const late = reducer(switched, fetchExecutorsSuccess('repairs_main', executors, false));

      expect(late).toBe(switched);
    });
  });
});
