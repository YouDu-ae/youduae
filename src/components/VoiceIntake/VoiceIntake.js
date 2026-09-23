import React, { useEffect, useRef, useState } from 'react';

import { trackVoiceDraftReady, trackVoiceSessionStarted } from '../../analytics/plausibleEvents';

import css from './VoiceIntake.module.css';

/**
 * Голосовой ввод задания (пилот на GPT-Live).
 *
 * Звук идёт по WebRTC напрямую между браузером и OpenAI. Сервер только открывает
 * сессию и исполняет инструменты: когда backend-модель вызывает функцию, событие
 * приходит сюда по data channel, отсюда уходит на /api/voice/tool, а результат
 * возвращается в сессию. Когда черновик готов, компонент отдаёт его мастеру —
 * публикует задание человек, а не помощник.
 */

// Разговор о задании занимает пару минут; дольше — значит, что-то пошло не так,
// а каждая минута оплачивается.
const MAX_SESSION_MS = 5 * 60 * 1000;
const CLOSE_TIMEOUT_MS = 15 * 1000;
const ICE_TIMEOUT_MS = 10 * 1000;

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

const waitForIceGathering = peer =>
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
      reject(new VoiceError('Не удалось установить соединение. Проверьте интернет и попробуйте ещё раз.'));
    }, ICE_TIMEOUT_MS);
    peer.addEventListener('icegatheringstatechange', onChange);
  });

const sessionErrorMessage = (status, data) => {
  if (status === 429) {
    return data?.message || 'На сегодня голосовые разговоры закончились. Заполните задание вручную.';
  }
  if (status === 401) {
    return 'Войдите, чтобы рассказать о задании голосом.';
  }
  return 'Не удалось начать разговор. Попробуйте ещё раз или заполните задание вручную.';
};

const microphoneErrorMessage = error => {
  if (error instanceof VoiceError) return error.message;
  if (error?.name === 'NotAllowedError') {
    return 'Нет доступа к микрофону. Разрешите его в настройках браузера и попробуйте ещё раз.';
  }
  if (error?.name === 'NotFoundError') {
    return 'Микрофон не найден. Подключите его или заполните задание вручную.';
  }
  return 'Не удалось начать разговор. Попробуйте ещё раз или заполните задание вручную.';
};

const emptyConnection = () => ({
  peer: null,
  channel: null,
  microphone: null,
  sessionId: null,
  // Вызовы функций копятся по delegation_id до завершения ответа backend-модели:
  // результаты нужно отдать все сразу и только потом продолжить.
  pendingCalls: new Map(),
  handledCallIds: new Set(),
  timers: [],
});

/**
 * @param {Object} props
 * @param {(draft: Object, meta: {sessionId: string}) => void} props.onDraft
 *   Черновик в формате guestListingStorage, без фотографий.
 */
const VoiceIntake = ({ onDraft }) => {
  // Открыт ли пилот этому пользователю, решает сервер; до ответа блок не виден,
  // чтобы кнопка не мелькала у тех, кому пилот закрыт.
  const [allowed, setAllowed] = useState(false);
  const [status, setStatus] = useState(STATUS.IDLE);
  const [message, setMessage] = useState(null);
  const [summary, setSummary] = useState(null);

  // Обработчики data channel переживают рендеры, поэтому всё соединение
  // держится в ref: state в их замыканиях был бы уже устаревшим.
  const connection = useRef(emptyConnection());
  const audioRef = useRef(null);
  const onDraftRef = useRef(onDraft);
  onDraftRef.current = onDraft;

  const cleanup = () => {
    const current = connection.current;
    current.timers.forEach(clearTimeout);
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
        if (!cancelled) setAllowed(data?.allowed === true);
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
      });
      return ok && data.output ? data.output : TOOL_UNAVAILABLE;
    } catch (error) {
      return TOOL_UNAVAILABLE;
    }
  };

  const submitPendingCalls = async delegationId => {
    const { pendingCalls, sessionId } = connection.current;
    const calls = pendingCalls.get(delegationId) || [];
    pendingCalls.delete(delegationId);
    if (calls.length === 0) return;

    for (const call of calls) {
      const output = await runTool(call);

      if (call.name === 'prepare_task_draft' && output.ok) {
        setSummary(output.summary);
        onDraftRef.current(output.draft, { sessionId });
        trackVoiceDraftReady({ category: output.draft.category });
      }

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

  const start = async () => {
    if (!isSupported()) {
      setStatus(STATUS.ERROR);
      setMessage('Этот браузер не поддерживает голосовой ввод. Заполните задание вручную.');
      return;
    }

    cleanup();
    setStatus(STATUS.CONNECTING);
    setMessage(null);
    setSummary(null);

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
      await waitForIceGathering(peer);

      const { ok, status: httpStatus, data } = await postJson('/api/voice/session', {
        sdp: peer.localDescription.sdp,
      });
      if (!ok) {
        throw new VoiceError(sessionErrorMessage(httpStatus, data));
      }

      connection.current.sessionId = data.sessionId;
      await peer.setRemoteDescription({ type: 'answer', sdp: data.sdp });

      trackVoiceSessionStarted();
      connection.current.timers.push(setTimeout(stop, MAX_SESSION_MS));
    } catch (error) {
      cleanup();
      setStatus(STATUS.ERROR);
      setMessage(microphoneErrorMessage(error));
    }
  };

  if (!allowed) {
    return null;
  }

  const isBusy = status === STATUS.CONNECTING || status === STATUS.FINISHING;
  const isTalking = status === STATUS.LISTENING;

  return (
    <div className={css.root}>
      <audio ref={audioRef} autoPlay playsInline className={css.audio} />

      <div className={css.header}>
        <div className={css.texts}>
          <div className={css.title}>Расскажите о задаче голосом</div>
          <div className={css.hint}>
            {isTalking
              ? 'Говорите — помощник слушает и задаст уточняющие вопросы.'
              : 'Опишите, что нужно, где, когда и за какой бюджет. Помощник заполнит поля, а вы проверите и опубликуете.'}
          </div>
        </div>

        {isTalking ? (
          <button type="button" className={css.stopButton} onClick={stop}>
            Завершить
          </button>
        ) : (
          <button type="button" className={css.startButton} onClick={start} disabled={isBusy}>
            {status === STATUS.CONNECTING
              ? 'Подключаюсь…'
              : status === STATUS.FINISHING
              ? 'Завершаю…'
              : 'Рассказать голосом'}
          </button>
        )}
      </div>

      {message ? <div className={css.error}>{message}</div> : null}

      {summary ? (
        <div className={css.summary}>
          <div className={css.summaryTitle}>Поля заполнены — проверьте их ниже</div>
          <ul className={css.summaryList}>
            <li>
              {summary.category}
              {summary.subcategory ? ` → ${summary.subcategory}` : ''}
            </li>
            <li>{summary.address}</li>
            <li>Срок: {summary.deadline}</li>
            <li>Бюджет: {summary.price_aed} AED</li>
          </ul>
        </div>
      ) : null}

      <div className={css.privacy}>
        Речь распознаёт OpenAI. Запись разговора YouDu не хранит.
      </div>
    </div>
  );
};

export default VoiceIntake;
