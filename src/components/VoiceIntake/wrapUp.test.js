import {
  AFTER_GOODBYE_MS,
  GOODBYE_TIMEOUT_MS,
  IDLE_MS,
  initialWrapUp,
  nextStep,
  onAssistantSpeech,
  onDraftReady,
  onFarewellRequested,
  onUserSpeech,
} from './wrapUp';

const T0 = 1000000;

describe('voice wrap-up', () => {
  it('never ends the conversation before the draft is ready', () => {
    expect(nextStep(initialWrapUp(), T0 + 10 * IDLE_MS)).toBe('wait');
  });

  it('asks for a goodbye after 15 seconds of silence once the draft is ready', () => {
    const state = onDraftReady(initialWrapUp(), T0);
    expect(nextStep(state, T0 + IDLE_MS - 1)).toBe('wait');
    expect(nextStep(state, T0 + IDLE_MS)).toBe('ask-farewell');
  });

  it('closes shortly after the assistant says the closing words', () => {
    let state = onDraftReady(initialWrapUp(), T0);
    state = onFarewellRequested(state, T0 + IDLE_MS);
    state = onAssistantSpeech(state, 'Задание готово. Всего ', T0 + IDLE_MS + 1000);
    state = onAssistantSpeech(state, 'доброго!', T0 + IDLE_MS + 1500);

    expect(state.goodbyeHeard).toBe(true);
    expect(nextStep(state, T0 + IDLE_MS + 1500 + AFTER_GOODBYE_MS - 1)).toBe('wait');
    expect(nextStep(state, T0 + IDLE_MS + 1500 + AFTER_GOODBYE_MS)).toBe('close');
  });

  it('closes when the person says that is all and the assistant says goodbye', () => {
    let state = onDraftReady(initialWrapUp(), T0);
    state = onUserSpeech(state, T0 + 3000);
    state = onAssistantSpeech(state, 'Хорошо. Всего доброго!', T0 + 4000);
    expect(nextStep(state, T0 + 4000 + AFTER_GOODBYE_MS)).toBe('close');
  });

  it('keeps talking if the person speaks up before the goodbye', () => {
    let state = onDraftReady(initialWrapUp(), T0);
    state = onFarewellRequested(state, T0 + IDLE_MS);
    state = onUserSpeech(state, T0 + IDLE_MS + 500);

    expect(state.farewellRequestedAt).toBe(0);
    expect(nextStep(state, T0 + IDLE_MS + 1000)).toBe('wait');
  });

  it('ignores the closing words before the draft exists', () => {
    const state = onAssistantSpeech(initialWrapUp(), 'Всего доброго', T0);
    expect(state.goodbyeHeard).toBe(false);
  });

  it('closes anyway if the goodbye never comes', () => {
    let state = onDraftReady(initialWrapUp(), T0);
    state = onFarewellRequested(state, T0 + IDLE_MS);
    expect(nextStep(state, T0 + IDLE_MS + GOODBYE_TIMEOUT_MS)).toBe('close');
  });
});
