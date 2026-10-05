import { createFakeDispatch, dispatchedActions } from '../../util/testHelpers';
import reducer, {
  loadData,
  fetchTaskOfTheMonthSuccess,
  serverDataReused,
} from './CooperationPage.duck';

const task = {
  title: 'Реставрационные работы',
  amountAED: 2700,
  specialist: { id: 'u1', displayName: 'Мастер', avatarUrl: null },
  review: null,
};

const stateWith = pageState => () => ({
  CooperationPage: { ...reducer(undefined, {}), ...pageState },
});

const respondWith = body =>
  jest.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve(body) }));

describe('CooperationPage duck', () => {
  beforeEach(() => {
    global.fetch = respondWith({ month: '2026-09', task });
  });
  afterEach(() => {
    delete global.fetch;
  });

  it('loads the task of the month', () => {
    const getState = stateWith({});
    const dispatch = createFakeDispatch(getState);

    return loadData({}, '', {})(dispatch, getState).then(() => {
      expect(global.fetch).toHaveBeenCalledWith('http://localhost/api/task-of-the-month', {});
      expect(dispatchedActions(dispatch)).toEqual([
        fetchTaskOfTheMonthSuccess('2026-09', task, false),
      ]);
    });
  });

  it('accepts a month without a finished task', () => {
    global.fetch = respondWith({ month: '2026-09', task: null });
    const getState = stateWith({});
    const dispatch = createFakeDispatch(getState);

    return loadData({}, '', {})(dispatch, getState).then(() => {
      expect(dispatchedActions(dispatch)).toEqual([
        fetchTaskOfTheMonthSuccess('2026-09', null, false),
      ]);
    });
  });

  it('reuses the task rendered on the server instead of fetching it again', () => {
    const getState = stateWith({ month: '2026-09', taskOfTheMonth: task, loadedOnServer: true });
    const dispatch = createFakeDispatch(getState);

    return loadData({}, '', {})(dispatch, getState).then(() => {
      expect(global.fetch).not.toHaveBeenCalled();
      expect(dispatchedActions(dispatch)).toEqual([serverDataReused()]);
    });
  });

  it('leaves the page without the block when the request fails', () => {
    global.fetch = jest.fn(() => Promise.resolve({ ok: false, status: 500 }));
    const getState = stateWith({});
    const dispatch = createFakeDispatch(getState);

    return loadData({}, '', {})(dispatch, getState).then(() => {
      expect(dispatchedActions(dispatch)).toEqual([]);
    });
  });

  describe('reducer', () => {
    it('keeps the task after the browser reuses the server answer', () => {
      const fromServer = reducer(undefined, fetchTaskOfTheMonthSuccess('2026-09', task, true));
      const reused = reducer(fromServer, serverDataReused());

      expect(fromServer.loadedOnServer).toBe(true);
      expect(reused).toEqual({ month: '2026-09', taskOfTheMonth: task, loadedOnServer: false });
    });
  });
});
