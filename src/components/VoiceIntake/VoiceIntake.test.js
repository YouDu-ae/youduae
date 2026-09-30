import React from 'react';
import '@testing-library/jest-dom';

import { renderWithProviders as render, testingLibrary } from '../../util/testHelpers';
import { trackVoiceDraftReady } from '../../analytics/plausibleEvents';

import VoiceIntake from './VoiceIntake';

jest.mock('../../analytics/plausibleEvents', () => ({
  trackVoiceDraftReady: jest.fn(),
  trackVoiceSessionStarted: jest.fn(),
}));

const { screen, fireEvent, waitFor, act } = testingLibrary;

const wizardScreen = (step, number, missing = []) => ({ step, number, total: 5, missing });
const titleScreen = wizardScreen('title', 1, ['title', 'description']);

const intake = (props = {}) => <VoiceIntake onFields={jest.fn()} screen={titleScreen} {...props} />;

// jsdom has no WebRTC, so the peer and its data channel are stand-ins that
// record what the component sends and let a test play OpenAI's side.
const createFakes = () => {
  const channel = {
    readyState: 'open',
    listeners: {},
    send: jest.fn(),
    close: jest.fn(),
    addEventListener(type, listener) {
      this.listeners[type] = listener;
    },
    emit(event) {
      act(() => {
        this.listeners.message({ data: JSON.stringify(event) });
      });
    },
  };

  const peer = {
    iceGatheringState: 'complete',
    localDescription: null,
    addTrack: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    createDataChannel: jest.fn(() => channel),
    createOffer: jest.fn(async () => ({ type: 'offer', sdp: 'v=0 offer' })),
    setLocalDescription: jest.fn(async description => {
      peer.localDescription = description;
    }),
    setRemoteDescription: jest.fn(async () => {}),
    close: jest.fn(),
  };

  const track = { stop: jest.fn() };
  const microphone = { getAudioTracks: () => [track], getTracks: () => [track] };

  return { channel, peer, microphone };
};

const response = (status, data) => ({ ok: status < 400, status, json: async () => data });

const sentEvents = channel => channel.send.mock.calls.map(([payload]) => JSON.parse(payload));

const functionCall = (callId, name, args) => ({
  type: 'response.event',
  delegation_id: 'deleg_1',
  event: {
    type: 'response.output_item.done',
    item: { type: 'function_call', call_id: callId, name, arguments: JSON.stringify(args) },
  },
});

const responseCompleted = {
  type: 'response.event',
  delegation_id: 'deleg_1',
  event: { type: 'response.completed' },
};

describe('VoiceIntake', () => {
  let fakes;
  let toolResponse;
  let accessResponse;
  let consentResponse;
  let sessionResponse;

  beforeEach(() => {
    fakes = createFakes();
    toolResponse = response(200, { output: { ok: true, candidates: [] } });
    accessResponse = response(200, { allowed: true, consented: true });
    consentResponse = response(200, { consented: true });
    sessionResponse = response(201, { sessionId: 'sess_1', sdp: 'v=0 answer' });

    window.RTCPeerConnection = jest.fn(() => fakes.peer);
    window.MediaStream = jest.fn();
    Object.defineProperty(window.navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: jest.fn(async () => fakes.microphone) },
    });
    jest.spyOn(window.HTMLMediaElement.prototype, 'play').mockImplementation(async () => {});

    global.fetch = jest.fn(async url => {
      if (url === '/api/voice/access') return accessResponse;
      if (url === '/api/voice/consent') return consentResponse;
      if (url === '/api/voice/session') return sessionResponse;
      return toolResponse;
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete window.RTCPeerConnection;
    delete global.fetch;
  });

  const clickStart = async () => {
    fireEvent.click(await screen.findByRole('button', { name: 'VoiceIntake.start' }));
  };

  const startConversation = async () => {
    await clickStart();
    await waitFor(() => expect(fakes.peer.setRemoteDescription).toHaveBeenCalled());
    fakes.channel.emit({ type: 'session.started' });
  };

  const requestsTo = url =>
    global.fetch.mock.calls
      .filter(([calledUrl]) => calledUrl === url)
      .map(([, request]) => JSON.parse(request.body));

  const toolRequests = () => requestsTo('/api/voice/tool');

  it('stays out of sight for people outside the pilot', async () => {
    accessResponse = response(200, { allowed: false });

    const { container } = render(intake());

    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/voice/access', expect.anything()));
    expect(container).toBeEmptyDOMElement();
  });

  it('connects with the answer the server returns', async () => {
    render(intake());
    await startConversation();

    expect(requestsTo('/api/voice/session')).toEqual([
      { sdp: 'v=0 offer', currentFields: {}, mode: 'steps', currentStep: 'title' },
    ]);
    expect(fakes.peer.setRemoteDescription).toHaveBeenCalledWith({
      type: 'answer',
      sdp: 'v=0 answer',
    });
    expect(screen.getByRole('button', { name: 'VoiceIntake.stop' })).toBeInTheDocument();
  });

  it('asks the assistant to greet first once the session starts', async () => {
    sessionResponse = response(201, {
      sessionId: 'sess_1',
      sdp: 'v=0 answer',
      greeting: 'Поздоровайся сейчас',
    });
    render(intake());
    await startConversation();

    expect(sentEvents(fakes.channel)).toContainEqual({
      type: 'session.instructions.append',
      event_id: 'greeting',
      delegation_id: null,
      content: 'Поздоровайся сейчас',
    });
  });

  // Results have to go back together, and only then may the backend continue.
  it('runs a call once the backend response completes, then continues it', async () => {
    render(intake());
    await startConversation();

    fakes.channel.emit(functionCall('call_1', 'resolve_location', { query: 'Marina' }));
    expect(toolRequests()).toEqual([]);

    fakes.channel.emit(responseCompleted);

    await waitFor(() => expect(sentEvents(fakes.channel)).toHaveLength(2));
    expect(toolRequests()).toEqual([
      { sessionId: 'sess_1', name: 'resolve_location', arguments: '{"query":"Marina"}' },
    ]);
    expect(sentEvents(fakes.channel)).toEqual([
      {
        type: 'response.item.create',
        item: {
          type: 'function_call_output',
          call_id: 'call_1',
          output: JSON.stringify({ ok: true, candidates: [] }),
        },
      },
      { type: 'response.create' },
    ]);
  });

  it('runs each call once even if the event repeats', async () => {
    render(intake());
    await startConversation();

    fakes.channel.emit(functionCall('call_1', 'resolve_location', { query: 'Marina' }));
    fakes.channel.emit(functionCall('call_1', 'resolve_location', { query: 'Marina' }));
    fakes.channel.emit(responseCompleted);

    await waitFor(() => expect(sentEvents(fakes.channel)).toHaveLength(2));
    expect(toolRequests()).toHaveLength(1);
  });

  describe('filling the wizard step by step', () => {
    const fields = {
      title: 'Нужен электрик',
      description: 'Не работают розетки на кухне, приходить после 18:00.',
    };

    const fillOutput = () => JSON.parse(sentEvents(fakes.channel)[0].item.output);
    const stepUpdates = () =>
      sentEvents(fakes.channel).filter(event => String(event.event_id || '').startsWith('step-'));

    beforeEach(() => {
      trackVoiceDraftReady.mockClear();
      toolResponse = response(200, { output: { ok: true, fields, complete: false } });
    });

    it('puts what the assistant filled into the wizard and says what the screen shows', async () => {
      const onFields = jest.fn(() => wizardScreen('details', 2, ['category', 'deadline']));
      const currentFields = { title: '', price: '' };
      render(intake({ onFields, currentFields }));
      await startConversation();

      fakes.channel.emit(functionCall('call_2', 'fill_task_fields', fields));
      fakes.channel.emit(responseCompleted);

      await waitFor(() => expect(sentEvents(fakes.channel)).toHaveLength(2));
      expect(onFields).toHaveBeenCalledWith(fields, { sessionId: 'sess_1' });
      expect(toolRequests()).toEqual([
        {
          sessionId: 'sess_1',
          name: 'fill_task_fields',
          arguments: JSON.stringify(fields),
          form: currentFields,
        },
      ]);
      expect(fillOutput()).toEqual({
        ok: true,
        fields,
        complete: false,
        screen: 'Открыт шаг 2 из 5 «Детали». Не хватает: категория, срок.',
      });
      expect(trackVoiceDraftReady).not.toHaveBeenCalled();
    });

    // A misheard budget fills nothing, but the assistant still needs to know
    // where the person is.
    it('reports the open step when nothing could be filled', async () => {
      toolResponse = response(200, { output: { ok: false, fields: {}, errors: { price: 'нет' } } });
      const onFields = jest.fn();
      render(intake({ onFields, screen: wizardScreen('pricing', 4, ['price']) }));
      await startConversation();

      fakes.channel.emit(functionCall('call_3', 'fill_task_fields', { price: -1 }));
      fakes.channel.emit(responseCompleted);

      await waitFor(() => expect(sentEvents(fakes.channel)).toHaveLength(2));
      expect(onFields).not.toHaveBeenCalled();
      expect(fillOutput().screen).toBe('Открыт шаг 4 из 5 «Цена». Не хватает: бюджет.');
    });

    it('winds down once the wizard reaches the photos', async () => {
      const onFields = jest.fn(() => wizardScreen('photos', 5));
      render(intake({ onFields }));
      await startConversation();

      fakes.channel.emit(functionCall('call_4', 'fill_task_fields', { price: 400 }));
      fakes.channel.emit(responseCompleted);

      await waitFor(() => expect(trackVoiceDraftReady).toHaveBeenCalledTimes(1));
      expect(fillOutput().screen).toBe('Открыт шаг 5 из 5 «Фото». Все поля заполнены, фото пока нет.');
    });

    it('starts on the step that is open', async () => {
      render(intake({ screen: wizardScreen('location', 3, ['location']) }));
      await startConversation();

      expect(requestsTo('/api/voice/session')[0].currentStep).toBe('location');
    });

    it('asks about a step the person opened with «Далее»', async () => {
      const { rerender } = render(intake());
      await startConversation();

      rerender(intake({ screen: wizardScreen('location', 3, ['location']) }));

      await waitFor(() => expect(stepUpdates()).toHaveLength(1), { timeout: 3000 });
      expect(stepUpdates()[0]).toMatchObject({
        type: 'session.instructions.append',
        delegation_id: null,
        content: expect.stringContaining('шаг 3 из 5 «Локация». На нём не хватает: адрес.'),
      });
    });

    it('only notes a filled step the person went back to look at', async () => {
      const { rerender } = render(intake({ screen: wizardScreen('pricing', 4, ['price']) }));
      await startConversation();

      rerender(intake({ screen: wizardScreen('details', 2) }));

      await waitFor(() => expect(stepUpdates()).toHaveLength(1), { timeout: 3000 });
      expect(stepUpdates()[0].type).toBe('session.thinking.append');
    });

    it('stays quiet about a step the assistant moved to itself', async () => {
      const details = wizardScreen('details', 2, ['category', 'deadline']);
      const onFields = jest.fn(() => details);
      const { rerender } = render(intake({ onFields }));
      await startConversation();

      fakes.channel.emit(functionCall('call_5', 'fill_task_fields', fields));
      fakes.channel.emit(responseCompleted);
      await waitFor(() => expect(onFields).toHaveBeenCalled());
      rerender(intake({ onFields, screen: details }));

      await new Promise(resolve => setTimeout(resolve, 1700));
      expect(stepUpdates()).toEqual([]);
    });
  });

  it('tells the server what the form already holds', async () => {
    render(intake({ currentFields: { title: 'Кран', price: '300' } }));
    await startConversation();

    expect(requestsTo('/api/voice/session')).toEqual([
      {
        sdp: 'v=0 offer',
        currentFields: { title: 'Кран', price: '300' },
        mode: 'steps',
        currentStep: 'title',
      },
    ]);
  });

  // Silence would leave the person waiting; the assistant should offer the form.
  it('tells the assistant when the tool server fails', async () => {
    toolResponse = response(500, { error: 'Tool failed' });

    render(intake());
    await startConversation();

    fakes.channel.emit(functionCall('call_3', 'resolve_location', { query: 'Marina' }));
    fakes.channel.emit(responseCompleted);

    await waitFor(() => expect(sentEvents(fakes.channel)).toHaveLength(2));
    const output = JSON.parse(sentEvents(fakes.channel)[0].item.output);
    expect(output.ok).toBe(false);
  });

  it('explains the daily limit instead of failing silently', async () => {
    sessionResponse = response(429, {
      error: 'daily_limit',
      message: 'На сегодня голосовые разговоры закончились.',
    });

    render(intake());
    await clickStart();

    expect(await screen.findByText('На сегодня голосовые разговоры закончились.')).toBeInTheDocument();
    expect(fakes.microphone.getTracks()[0].stop).toHaveBeenCalled();
  });

  it('explains a refused microphone', async () => {
    window.navigator.mediaDevices.getUserMedia = jest.fn(async () => {
      const error = new Error('denied');
      error.name = 'NotAllowedError';
      throw error;
    });

    render(intake());
    await clickStart();

    expect(await screen.findByText('VoiceIntake.microphoneDenied')).toBeInTheDocument();
    expect(requestsTo('/api/voice/session')).toEqual([]);
  });

  it('asks the session to close when the person is done', async () => {
    render(intake());
    await startConversation();

    fireEvent.click(screen.getByRole('button', { name: 'VoiceIntake.stop' }));

    expect(sentEvents(fakes.channel)).toEqual([{ type: 'session.close' }]);
  });

  describe('consent', () => {
    beforeEach(() => {
      accessResponse = response(200, { allowed: true, consented: false });
    });

    it('asks before the first conversation and sends nothing until allowed', async () => {
      render(intake());
      await clickStart();

      expect(await screen.findByText('VoiceIntake.consentTitle')).toBeInTheDocument();
      expect(navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled();
      expect(requestsTo('/api/voice/session')).toEqual([]);
    });

    it('records consent, then opens the conversation from the same click', async () => {
      render(intake());
      await clickStart();
      fireEvent.click(await screen.findByRole('button', { name: 'VoiceIntake.consentAccept' }));

      await waitFor(() => expect(fakes.peer.setRemoteDescription).toHaveBeenCalled());
      expect(requestsTo('/api/voice/consent')).toEqual([{ granted: true }]);

      const order = global.fetch.mock.calls.map(([url]) => url);
      expect(order.indexOf('/api/voice/consent')).toBeLessThan(order.indexOf('/api/voice/session'));
    });

    it('does not start when consent could not be saved', async () => {
      consentResponse = response(500, { error: 'consent_not_saved' });
      render(intake());
      await clickStart();
      fireEvent.click(await screen.findByRole('button', { name: 'VoiceIntake.consentAccept' }));

      expect(await screen.findByText('VoiceIntake.consentNotSaved')).toBeInTheDocument();
      expect(requestsTo('/api/voice/session')).toEqual([]);
    });

    it('goes back to the form when the person declines', async () => {
      render(intake());
      await clickStart();
      fireEvent.click(await screen.findByRole('button', { name: 'VoiceIntake.consentDecline' }));

      expect(await screen.findByRole('button', { name: 'VoiceIntake.start' })).toBeInTheDocument();
      expect(requestsTo('/api/voice/consent')).toEqual([]);
    });

    it('asks again when the server says consent is missing', async () => {
      accessResponse = response(200, { allowed: true, consented: true });
      sessionResponse = response(403, { error: 'consent_required' });
      render(intake());
      await clickStart();

      expect(await screen.findByText('VoiceIntake.consentTitle')).toBeInTheDocument();
    });

    it('lets the person withdraw consent', async () => {
      accessResponse = response(200, { allowed: true, consented: true });
      render(intake());
      fireEvent.click(await screen.findByRole('button', { name: 'VoiceIntake.consentWithdraw' }));

      expect(await screen.findByText('VoiceIntake.consentWithdrawn')).toBeInTheDocument();
      expect(requestsTo('/api/voice/consent')).toEqual([{ granted: false }]);
      expect(screen.queryByRole('button', { name: 'VoiceIntake.consentWithdraw' })).toBeNull();
    });
  });
});
