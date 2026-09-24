import React from 'react';
import '@testing-library/jest-dom';

import { renderWithProviders as render, testingLibrary } from '../../util/testHelpers';

import VoiceIntake from './VoiceIntake';

const { screen, fireEvent, waitFor, act } = testingLibrary;

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

    const { container } = render(<VoiceIntake onDraft={jest.fn()} />);

    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/voice/access', expect.anything()));
    expect(container).toBeEmptyDOMElement();
  });

  it('connects with the answer the server returns', async () => {
    render(<VoiceIntake onDraft={jest.fn()} />);
    await startConversation();

    expect(requestsTo('/api/voice/session')).toEqual([{ sdp: 'v=0 offer' }]);
    expect(fakes.peer.setRemoteDescription).toHaveBeenCalledWith({
      type: 'answer',
      sdp: 'v=0 answer',
    });
    expect(screen.getByRole('button', { name: 'VoiceIntake.stop' })).toBeInTheDocument();
  });

  // Results have to go back together, and only then may the backend continue.
  it('runs a call once the backend response completes, then continues it', async () => {
    render(<VoiceIntake onDraft={jest.fn()} />);
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
    render(<VoiceIntake onDraft={jest.fn()} />);
    await startConversation();

    fakes.channel.emit(functionCall('call_1', 'resolve_location', { query: 'Marina' }));
    fakes.channel.emit(functionCall('call_1', 'resolve_location', { query: 'Marina' }));
    fakes.channel.emit(responseCompleted);

    await waitFor(() => expect(sentEvents(fakes.channel)).toHaveLength(2));
    expect(toolRequests()).toHaveLength(1);
  });

  it('hands a ready draft to the wizard and shows what was filled', async () => {
    const onDraft = jest.fn();
    const draft = { title: 'Нужен электрик', category: 'repairs_main' };
    toolResponse = response(200, {
      output: {
        ok: true,
        draft,
        summary: {
          category: 'Ремонт и строительство',
          subcategory: 'Электромонтажные работы',
          deadline: 'завтра',
          price_aed: 400,
          address: 'Dubai Marina, Dubai, UAE',
        },
      },
    });

    render(<VoiceIntake onDraft={onDraft} />);
    await startConversation();

    fakes.channel.emit(functionCall('call_2', 'prepare_task_draft', {}));
    fakes.channel.emit(responseCompleted);

    await waitFor(() => expect(onDraft).toHaveBeenCalledWith(draft, { sessionId: 'sess_1' }));
    expect(screen.getByText('Dubai Marina, Dubai, UAE')).toBeInTheDocument();
    expect(screen.getByText('VoiceIntake.summaryBudget')).toBeInTheDocument();
  });

  // Silence would leave the person waiting; the assistant should offer the form.
  it('tells the assistant when the tool server fails', async () => {
    toolResponse = response(500, { error: 'Tool failed' });

    render(<VoiceIntake onDraft={jest.fn()} />);
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

    render(<VoiceIntake onDraft={jest.fn()} />);
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

    render(<VoiceIntake onDraft={jest.fn()} />);
    await clickStart();

    expect(await screen.findByText('VoiceIntake.microphoneDenied')).toBeInTheDocument();
    expect(requestsTo('/api/voice/session')).toEqual([]);
  });

  it('asks the session to close when the person is done', async () => {
    render(<VoiceIntake onDraft={jest.fn()} />);
    await startConversation();

    fireEvent.click(screen.getByRole('button', { name: 'VoiceIntake.stop' }));

    expect(sentEvents(fakes.channel)).toEqual([{ type: 'session.close' }]);
  });

  describe('consent', () => {
    beforeEach(() => {
      accessResponse = response(200, { allowed: true, consented: false });
    });

    it('asks before the first conversation and sends nothing until allowed', async () => {
      render(<VoiceIntake onDraft={jest.fn()} />);
      await clickStart();

      expect(await screen.findByText('VoiceIntake.consentTitle')).toBeInTheDocument();
      expect(navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled();
      expect(requestsTo('/api/voice/session')).toEqual([]);
    });

    it('records consent, then opens the conversation from the same click', async () => {
      render(<VoiceIntake onDraft={jest.fn()} />);
      await clickStart();
      fireEvent.click(await screen.findByRole('button', { name: 'VoiceIntake.consentAccept' }));

      await waitFor(() => expect(fakes.peer.setRemoteDescription).toHaveBeenCalled());
      expect(requestsTo('/api/voice/consent')).toEqual([{ granted: true }]);

      const order = global.fetch.mock.calls.map(([url]) => url);
      expect(order.indexOf('/api/voice/consent')).toBeLessThan(order.indexOf('/api/voice/session'));
    });

    it('does not start when consent could not be saved', async () => {
      consentResponse = response(500, { error: 'consent_not_saved' });
      render(<VoiceIntake onDraft={jest.fn()} />);
      await clickStart();
      fireEvent.click(await screen.findByRole('button', { name: 'VoiceIntake.consentAccept' }));

      expect(await screen.findByText('VoiceIntake.consentNotSaved')).toBeInTheDocument();
      expect(requestsTo('/api/voice/session')).toEqual([]);
    });

    it('goes back to the form when the person declines', async () => {
      render(<VoiceIntake onDraft={jest.fn()} />);
      await clickStart();
      fireEvent.click(await screen.findByRole('button', { name: 'VoiceIntake.consentDecline' }));

      expect(await screen.findByRole('button', { name: 'VoiceIntake.start' })).toBeInTheDocument();
      expect(requestsTo('/api/voice/consent')).toEqual([]);
    });

    it('asks again when the server says consent is missing', async () => {
      accessResponse = response(200, { allowed: true, consented: true });
      sessionResponse = response(403, { error: 'consent_required' });
      render(<VoiceIntake onDraft={jest.fn()} />);
      await clickStart();

      expect(await screen.findByText('VoiceIntake.consentTitle')).toBeInTheDocument();
    });

    it('lets the person withdraw consent', async () => {
      accessResponse = response(200, { allowed: true, consented: true });
      render(<VoiceIntake onDraft={jest.fn()} />);
      fireEvent.click(await screen.findByRole('button', { name: 'VoiceIntake.consentWithdraw' }));

      expect(await screen.findByText('VoiceIntake.consentWithdrawn')).toBeInTheDocument();
      expect(requestsTo('/api/voice/consent')).toEqual([{ granted: false }]);
      expect(screen.queryByRole('button', { name: 'VoiceIntake.consentWithdraw' })).toBeNull();
    });
  });
});
