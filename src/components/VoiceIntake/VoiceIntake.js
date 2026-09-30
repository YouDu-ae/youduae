import React, { useEffect, useRef, useState } from 'react';

import { trackVoiceDraftReady, trackVoiceSessionStarted } from '../../analytics/plausibleEvents';
import { useIntl } from '../../util/reactIntl';
import NamedLink from '../NamedLink/NamedLink';
import {
  initialWrapUp,
  nextStep,
  onAssistantSpeech,
  onDraftReady,
  onFarewellRequested,
  onUserSpeech,
} from './wrapUp';
import { describeScreen, stepOpenedUpdate } from './wizardScreen';

import css from './VoiceIntake.module.css';

/**
 * Голосовой ввод задания (пилот на GPT-Live).
 *
 * Звук идёт по WebRTC напрямую между браузером и OpenAI. Сервер только открывает
 * сессию и исполняет инструменты: когда backend-модель вызывает функцию, событие
 * приходит сюда по data channel, отсюда уходит на /api/voice/tool, а результат
 * возвращается в сессию. Поля, которые помощник вписал через fill_task_fields,
 * компонент сразу отдаёт мастеру, и тот переходит к следующему шагу. Разговор
 * заканчивается на шаге «Фото» — фото добавляет и публикует задание человек.
 */

// Разговор о задании занимает пару минут; дольше — значит, что-то пошло не так,
// а каждая минута оплачивается.
const MAX_SESSION_MS = 5 * 60 * 1000;
const CLOSE_TIMEOUT_MS = 15 * 1000;
const ICE_TIMEOUT_MS = 10 * 1000;
const WRAP_UP_CHECK_MS = 1000;
// Someone clicking «Назад» twice to look at a step should not get a question
// about every step on the way.
const STEP_SETTLE_MS = 1500;

const STATUS = {
  IDLE: 'idle',
  CONNECTING: 'connecting',
  LISTENING: 'listening',
  FINISHING: 'finishing',
  ERROR: 'error',
};

// Ответ, который помощник получит, если сервер инструментов недоступен: пусть
// лучше честно предложит заполнить форму, чем молчит.
const TOOL_UNAVAILABLE = {
  ok: false,
  error: 'Сервис временно недоступен. Предложи заполнить задание вручную.',
};

class VoiceError extends Error {}

// The server refused because consent is missing, e.g. withdrawn in another tab.
class ConsentRequiredError extends VoiceError {}

const isSupported = () =>
  typeof window !== 'undefined' &&
  typeof window.RTCPeerConnection === 'function' &&
  !!window.navigator?.mediaDevices?.getUserMedia;

const postJson = async (url, body) => {
  const response = await fetch(url, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, data };
};

const waitForIceGathering = (peer, intl) =>
  new Promise((resolve, reject) => {
    if (peer.iceGatheringState === 'complete') {
      resolve();
      return;
    }
    const onChange = () => {
      if (peer.iceGatheringState !== 'complete') return;
      clearTimeout(timeout);
      peer.removeEventListener('icegatheringstatechange', onChange);
      resolve();
    };
    const timeout = setTimeout(() => {
      peer.removeEventListener('icegatheringstatechange', onChange);
      reject(new VoiceError(intl.formatMessage({ id: 'VoiceIntake.connectionFailed' })));
    }, ICE_TIMEOUT_MS);
    peer.addEventListener('icegatheringstatechange', onChange);
  });

const sessionErrorMessage = (status, data, intl) => {
  if (status === 429) {
    return data?.message || intl.formatMessage({ id: 'VoiceIntake.dailyLimitReached' });
  }
  if (status === 401) {
    return intl.formatMessage({ id: 'VoiceIntake.loginRequired' });
  }
  return intl.formatMessage({ id: 'VoiceIntake.startFailed' });
};

const microphoneErrorMessage = (error, intl) => {
  if (error instanceof VoiceError) return error.message;
  if (error?.name === 'NotAllowedError') {
    return intl.formatMessage({ id: 'VoiceIntake.microphoneDenied' });
  }
  if (error?.name === 'NotFoundError') {
    return intl.formatMessage({ id: 'VoiceIntake.microphoneNotFound' });
  }
  return intl.formatMessage({ id: 'VoiceIntake.startFailed' });
};

const emptyConnection = () => ({
  peer: null,
  channel: null,
  microphone: null,
  sessionId: null,
  greeting: null,
  farewell: null,
  // The wizard step the assistant last heard about.
  lastStep: null,
  wrapUp: initialWrapUp(),
  // Вызовы функций копятся по delegation_id до завершения ответа backend-модели:
  // результаты нужно отдать все сразу и только потом продолжить.
  pendingCalls: new Map(),
  handledCallIds: new Set(),
  timers: [],
  intervals: [],
});

/**
 * @param {Object} props
 * @param {(fields: Object, meta: {sessionId: string}) => import('./wizardScreen').WizardScreen} props.onFields
 *   Puts the fields the assistant filled (in guestListingStorage shape, never
 *   photos) into the wizard and returns the screen after that, including any
 *   step the wizard moved on to.
 * @param {import('./wizardScreen').WizardScreen} props.screen the step open now.
 * @param {Object} [props.currentFields] what the form holds now (title,
 *   description, category, subcategory, deadline, paymentMethod, address,
 *   price), so the assistant can change part of it instead of starting over.
 * @param {boolean} [props.hasPhotos] whether photos are attached; without them
 *   the assistant suggests adding some on the last step.
 */
const VoiceIntake = ({ onFields, screen, currentFields, hasPhotos = false }) => {
  const intl = useIntl();
  // Открыт ли пилот этому пользователю, решает сервер; до ответа блок не виден,
  // чтобы кнопка не мелькала у тех, кому пилот закрыт.
  const [allowed, setAllowed] = useState(false);
  const [consented, setConsented] = useState(false);
  const [askingConsent, setAskingConsent] = useState(false);
  const [status, setStatus] = useState(STATUS.IDLE);
  const [message, setMessage] = useState(null);

  // Обработчики data channel переживают рендеры, поэтому всё соединение
  // держится в ref: state в их замыканиях был бы уже устаревшим.
  const connection = useRef(emptyConnection());
  const audioRef = useRef(null);
  const onFieldsRef = useRef(onFields);
  onFieldsRef.current = onFields;
  const screenRef = useRef(screen);
  screenRef.current = screen;
  const currentFieldsRef = useRef(currentFields);
  currentFieldsRef.current = currentFields;
  const hasPhotosRef = useRef(hasPhotos);
  hasPhotosRef.current = hasPhotos;

  const cleanup = () => {
    const current = connection.current;
    current.timers.forEach(clearTimeout);
    current.intervals.forEach(clearInterval);
    current.microphone?.getTracks().forEach(track => track.stop());
    current.channel?.close();
    current.peer?.close();
    if (audioRef.current) {
      audioRef.current.srcObject = null;
    }
    connection.current = emptyConnection();
  };

  useEffect(() => cleanup, []);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/voice/access', { credentials: 'same-origin' })
      .then(response => (response.ok ? response.json() : { allowed: false }))
      .then(data => {
        if (cancelled) return;
        setAllowed(data?.allowed === true);
        setConsented(data?.consented === true);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const send = event => {
    const { channel } = connection.current;
    if (channel && channel.readyState === 'open') {
      channel.send(JSON.stringify(event));
    }
  };

  const runTool = async call => {
    try {
      const { ok, data } = await postJson('/api/voice/tool', {
        sessionId: connection.current.sessionId,
        name: call.name,
        arguments: call.arguments,
        // Lets the server tell whether the new fields complete the task.
        ...(call.name === 'fill_task_fields' ? { form: currentFieldsRef.current || {} } : {}),
      });
      return ok && data.output ? data.output : TOOL_UNAVAILABLE;
    } catch (error) {
      return TOOL_UNAVAILABLE;
    }
  };

  // The last step means every field is filled: from here the conversation
  // winds down on its own once both sides fall silent.
  const onLastStep = category => {
    const current = connection.current;
    if (current.wrapUp.draftReady) return;
    current.wrapUp = onDraftReady(current.wrapUp, Date.now());
    trackVoiceDraftReady({ category: category || currentFieldsRef.current?.category });
  };

  const applyFields = (output, sessionId) => {
    const hasFields = !!output.fields && Object.keys(output.fields).length > 0;
    const shown = hasFields
      ? onFieldsRef.current(output.fields, { sessionId })
      : screenRef.current;
    if (!shown) return output;

    connection.current.lastStep = shown.step;
    if (shown.step === 'photos') onLastStep(output.fields?.category);
    return { ...output, screen: describeScreen(shown, hasPhotosRef.current) };
  };

  // The person moved between steps themselves, with «Далее» or «Назад».
  const openStep = screen?.step;
  useEffect(() => {
    if (status !== STATUS.LISTENING || !openStep || openStep === connection.current.lastStep) {
      return undefined;
    }
    const timer = setTimeout(() => {
      const shown = screenRef.current;
      if (!shown || shown.step === connection.current.lastStep) return;
      connection.current.lastStep = shown.step;
      if (shown.step === 'photos') onLastStep();

      const { spoken, content } = stepOpenedUpdate(shown, hasPhotosRef.current);
      send({
        type: spoken ? 'session.instructions.append' : 'session.thinking.append',
        event_id: `step-${shown.step}-${Date.now()}`,
        delegation_id: null,
        content,
      });
    }, STEP_SETTLE_MS);
    return () => clearTimeout(timer);
  }, [openStep, status]);

  const submitPendingCalls = async delegationId => {
    const { pendingCalls, sessionId } = connection.current;
    const calls = pendingCalls.get(delegationId) || [];
    pendingCalls.delete(delegationId);
    if (calls.length === 0) return;

    for (const call of calls) {
      const result = await runTool(call);
      const output = call.name === 'fill_task_fields' ? applyFields(result, sessionId) : result;

      send({
        type: 'response.item.create',
        item: { type: 'function_call_output', call_id: call.call_id, output: JSON.stringify(output) },
      });
    }

    // Результат функции сам по себе не продолжает работу backend-модели.
    send({ type: 'response.create' });
  };

  const handleResponseEvent = (delegationId, nested) => {
    if (nested.type === 'response.output_item.done' && nested.item?.type === 'function_call') {
      const { call_id: callId, name, arguments: args } = nested.item;
      const { pendingCalls, handledCallIds } = connection.current;
      if (handledCallIds.has(callId)) return;
      handledCallIds.add(callId);
      const calls = pendingCalls.get(delegationId) || [];
      calls.push({ call_id: callId, name, arguments: args });
      pendingCalls.set(delegationId, calls);
      return;
    }

    if (nested.type === 'response.completed') {
      submitPendingCalls(delegationId);
    } else if (nested.type === 'response.failed' || nested.type === 'response.incomplete') {
      connection.current.pendingCalls.delete(delegationId);
    }
  };

  const handleEvent = event => {
    switch (event.type) {
      case 'session.started':
        setStatus(STATUS.LISTENING);
        // GPT-Live otherwise waits in silence for the person to speak first.
        if (connection.current.greeting) {
          send({
            type: 'session.instructions.append',
            event_id: 'greeting',
            delegation_id: null,
            content: connection.current.greeting,
          });
        }
        break;
      case 'session.input_transcript.delta':
        connection.current.wrapUp = onUserSpeech(connection.current.wrapUp, Date.now());
        break;
      case 'session.output_transcript.delta':
        connection.current.wrapUp = onAssistantSpeech(
          connection.current.wrapUp,
          event.delta || '',
          Date.now()
        );
        break;
      case 'session.closed':
        cleanup();
        setStatus(STATUS.IDLE);
        break;
      case 'response.event':
        handleResponseEvent(event.delegation_id, event.event || {});
        break;
      case 'error':
        console.error('Voice session error:', event);
        break;
      default:
        break;
    }
  };

  const checkWrapUp = () => {
    const current = connection.current;
    const now = Date.now();
    const step = nextStep(current.wrapUp, now);
    if (step === 'ask-farewell') {
      current.wrapUp = onFarewellRequested(current.wrapUp, now);
      if (current.farewell) {
        send({
          type: 'session.instructions.append',
          event_id: `farewell-${now}`,
          delegation_id: null,
          content: current.farewell,
        });
      }
    } else if (step === 'close') {
      current.wrapUp = initialWrapUp();
      stop();
    }
  };

  const stop = () => {
    const { channel } = connection.current;
    if (!channel || channel.readyState !== 'open') {
      cleanup();
      setStatus(STATUS.IDLE);
      return;
    }
    setStatus(STATUS.FINISHING);
    send({ type: 'session.close' });
    // Итоговое session.closed может не прийти, если связь уже рвётся.
    connection.current.timers.push(
      setTimeout(() => {
        cleanup();
        setStatus(STATUS.IDLE);
      }, CLOSE_TIMEOUT_MS)
    );
  };

  /**
   * @param {Promise<{ok: boolean}>} [consentSaved] consent being recorded right
   *   now; the session is requested only after it is stored. Starting from the
   *   same click keeps the microphone request inside the user gesture Safari
   *   on iPhone insists on.
   */
  const start = async consentSaved => {
    if (!isSupported()) {
      setStatus(STATUS.ERROR);
      setMessage(intl.formatMessage({ id: 'VoiceIntake.browserNotSupported' }));
      return;
    }

    cleanup();
    connection.current.lastStep = screenRef.current?.step || null;
    setStatus(STATUS.CONNECTING);
    setMessage(null);

    try {
      const peer = new RTCPeerConnection();
      connection.current.peer = peer;

      peer.addEventListener('track', event => {
        const audio = audioRef.current;
        if (!audio) return;
        audio.srcObject = new MediaStream([event.track]);
        audio.play().catch(() => {});
      });

      const microphone = await navigator.mediaDevices.getUserMedia({ audio: true });
      connection.current.microphone = microphone;
      microphone.getAudioTracks().forEach(track => peer.addTrack(track, microphone));

      // Канал событий создаётся до SDP-предложения, иначе он не попадёт в сессию.
      const channel = peer.createDataChannel('oai-events');
      connection.current.channel = channel;
      channel.addEventListener('message', ({ data }) => {
        try {
          handleEvent(JSON.parse(data));
        } catch (error) {
          console.error('Voice event could not be handled:', error);
        }
      });
      channel.addEventListener('close', () => {
        if (connection.current.channel !== channel) return;
        cleanup();
        setStatus(STATUS.IDLE);
      });

      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      await waitForIceGathering(peer, intl);

      if (consentSaved) {
        const saved = await consentSaved;
        if (!saved.ok) {
          throw new VoiceError(intl.formatMessage({ id: 'VoiceIntake.consentNotSaved' }));
        }
        setConsented(true);
      }

      const { ok, status: httpStatus, data } = await postJson('/api/voice/session', {
        sdp: peer.localDescription.sdp,
        currentFields: currentFieldsRef.current || {},
        mode: 'steps',
        currentStep: connection.current.lastStep,
      });
      if (httpStatus === 403 && data?.error === 'consent_required') {
        throw new ConsentRequiredError();
      }
      if (!ok) {
        throw new VoiceError(sessionErrorMessage(httpStatus, data, intl));
      }

      connection.current.sessionId = data.sessionId;
      connection.current.greeting = data.greeting || null;
      connection.current.farewell = data.farewell || null;
      await peer.setRemoteDescription({ type: 'answer', sdp: data.sdp });

      trackVoiceSessionStarted();
      connection.current.timers.push(setTimeout(stop, MAX_SESSION_MS));
      connection.current.intervals.push(setInterval(checkWrapUp, WRAP_UP_CHECK_MS));
    } catch (error) {
      cleanup();
      if (error instanceof ConsentRequiredError) {
        setConsented(false);
        setAskingConsent(true);
        setStatus(STATUS.IDLE);
        return;
      }
      setStatus(STATUS.ERROR);
      setMessage(microphoneErrorMessage(error, intl));
    }
  };

  const onStartClick = () => {
    if (consented) {
      start();
    } else {
      setMessage(null);
      setAskingConsent(true);
    }
  };

  const acceptConsent = () => {
    setAskingConsent(false);
    start(postJson('/api/voice/consent', { granted: true }).catch(() => ({ ok: false })));
  };

  const withdrawConsent = async () => {
    stop();
    const { ok } = await postJson('/api/voice/consent', { granted: false }).catch(() => ({
      ok: false,
    }));
    if (ok) {
      setConsented(false);
      setMessage(intl.formatMessage({ id: 'VoiceIntake.consentWithdrawn' }));
    } else {
      setMessage(intl.formatMessage({ id: 'VoiceIntake.consentNotSaved' }));
    }
  };

  if (!allowed) {
    return null;
  }

  if (askingConsent) {
    return (
      <div className={css.root} role="dialog" aria-labelledby="voice-consent-title">
        <div id="voice-consent-title" className={css.title}>
          {intl.formatMessage({ id: 'VoiceIntake.consentTitle' })}
        </div>
        <div className={css.consentText}>
          <p>{intl.formatMessage({ id: 'VoiceIntake.consentProvider' })}</p>
          <p>{intl.formatMessage({ id: 'VoiceIntake.consentStorage' })}</p>
          <p>{intl.formatMessage({ id: 'VoiceIntake.consentDraft' })}</p>
        </div>
        <NamedLink name="PrivacyPolicyPage" className={css.consentLink}>
          {intl.formatMessage({ id: 'VoiceIntake.consentPolicyLink' })}
        </NamedLink>
        <div className={css.consentActions}>
          <button type="button" className={css.startButton} onClick={acceptConsent}>
            {intl.formatMessage({ id: 'VoiceIntake.consentAccept' })}
          </button>
          <button
            type="button"
            className={css.stopButton}
            onClick={() => setAskingConsent(false)}
          >
            {intl.formatMessage({ id: 'VoiceIntake.consentDecline' })}
          </button>
        </div>
      </div>
    );
  }

  const isBusy = status === STATUS.CONNECTING || status === STATUS.FINISHING;
  const isTalking = status === STATUS.LISTENING;

  return (
    <div className={css.root}>
      <audio ref={audioRef} autoPlay playsInline className={css.audio} />

      <div className={css.header}>
        <div className={css.texts}>
          <div className={css.title}>{intl.formatMessage({ id: 'VoiceIntake.title' })}</div>
          <div className={css.hint}>
            {isTalking
              ? intl.formatMessage({ id: 'VoiceIntake.hintTalking' })
              : intl.formatMessage({ id: 'VoiceIntake.hintIdle' })}
          </div>
        </div>

        {isTalking ? (
          <button type="button" className={css.stopButton} onClick={stop}>
            {intl.formatMessage({ id: 'VoiceIntake.stop' })}
          </button>
        ) : (
          <button type="button" className={css.startButton} onClick={onStartClick} disabled={isBusy}>
            {status === STATUS.CONNECTING
              ? intl.formatMessage({ id: 'VoiceIntake.connecting' })
              : status === STATUS.FINISHING
              ? intl.formatMessage({ id: 'VoiceIntake.finishing' })
              : intl.formatMessage({ id: 'VoiceIntake.start' })}
          </button>
        )}
      </div>

      {message ? <div className={css.error}>{message}</div> : null}

      <div className={css.privacy}>
        {intl.formatMessage({ id: 'VoiceIntake.privacy' })}
        {consented ? (
          <>
            {' '}
            <button type="button" className={css.linkButton} onClick={withdrawConsent}>
              {intl.formatMessage({ id: 'VoiceIntake.consentWithdraw' })}
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
};

export default VoiceIntake;
