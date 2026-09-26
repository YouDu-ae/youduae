/**
 * When to end a voice conversation once the task draft is ready.
 *
 * GPT-Live has no "end of call" signal of its own: after reading out the draft
 * the assistant fell silent and the session kept recording until the five
 * minute cap. So, once the draft exists:
 * - after IDLE_MS of silence from both sides, ask the assistant to say goodbye;
 * - when its speech contains the closing words and then stops for
 *   AFTER_GOODBYE_MS, close the session;
 * - if the goodbye never comes, close anyway after GOODBYE_TIMEOUT_MS.
 *
 * The same rules live in the iOS app (src/utils/voiceWrapUp.ts).
 */

export const IDLE_MS = 15 * 1000;
export const AFTER_GOODBYE_MS = 2500;
export const GOODBYE_TIMEOUT_MS = 15 * 1000;

const CLOSING_WORDS = /всего доброго/i;
const TAIL_LENGTH = 80;

export const initialWrapUp = () => ({
  draftReady: false,
  lastSpeechAt: 0,
  lastAssistantSpeechAt: 0,
  farewellRequestedAt: 0,
  goodbyeHeard: false,
  assistantTail: '',
});

export const onDraftReady = (state, now) => ({ ...state, draftReady: true, lastSpeechAt: now });

export const onUserSpeech = (state, now) => ({
  ...state,
  lastSpeechAt: now,
  // The person spoke up after all: the conversation goes on.
  farewellRequestedAt: state.goodbyeHeard ? state.farewellRequestedAt : 0,
});

export const onAssistantSpeech = (state, delta, now) => {
  const assistantTail = state.draftReady
    ? `${state.assistantTail}${delta}`.slice(-TAIL_LENGTH)
    : state.assistantTail;
  return {
    ...state,
    lastSpeechAt: now,
    lastAssistantSpeechAt: now,
    assistantTail,
    goodbyeHeard: state.goodbyeHeard || (state.draftReady && CLOSING_WORDS.test(assistantTail)),
  };
};

/**
 * @returns {'wait'|'ask-farewell'|'close'}
 */
export const nextStep = (state, now) => {
  if (!state.draftReady) return 'wait';
  if (state.goodbyeHeard) {
    return now - state.lastAssistantSpeechAt >= AFTER_GOODBYE_MS ? 'close' : 'wait';
  }
  if (state.farewellRequestedAt) {
    return now - state.farewellRequestedAt >= GOODBYE_TIMEOUT_MS ? 'close' : 'wait';
  }
  return now - state.lastSpeechAt >= IDLE_MS ? 'ask-farewell' : 'wait';
};

export const onFarewellRequested = (state, now) => ({ ...state, farewellRequestedAt: now });
