const http = require('http');
const util = require('util');
const sharetribeSdk = require('sharetribe-flex-sdk');

jest.mock('@sentry/node', () => ({}));
const log = require('./log');

const TOKEN = 'user-access-token-kept-out-of-logs';

const startApi = () =>
  new Promise(resolve => {
    const server = http.createServer((req, res) => {
      res.writeHead(409, { 'Content-Type': 'application/transit+json' });
      res.end(
        sharetribeSdk.transit.write({
          errors: [{ status: 409, code: 'conflict-missing-key', title: 'Conflict' }],
        })
      );
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });

const sdkErrorFrom = baseUrl => {
  const tokenStore = sharetribeSdk.tokenStore.memoryStore();
  tokenStore.setToken({
    access_token: TOKEN,
    token_type: 'bearer',
    expires_in: 3600,
    scope: 'user',
    refresh_token: 'refresh-token',
  });
  const sdk = sharetribeSdk.createInstance({ clientId: 'client-id', baseUrl, tokenStore });
  return sdk.currentUser.show().then(
    () => {
      throw new Error('expected the request to fail');
    },
    e => e
  );
};

describe('server log', () => {
  let api;
  let apiError;
  let networkError;
  let consoleMethods;

  beforeAll(async () => {
    api = await startApi();
    apiError = await sdkErrorFrom(`http://127.0.0.1:${api.address().port}`);
    networkError = await sdkErrorFrom('http://127.0.0.1:1');
  });

  afterAll(() => new Promise(resolve => api.close(resolve)));

  beforeEach(() => {
    consoleMethods = { ...console };
  });

  afterEach(() => {
    Object.assign(console, consoleMethods);
  });

  const captureConsole = () => {
    const printed = [];
    ['debug', 'log', 'info', 'warn', 'error'].forEach(level => {
      console[level] = (...args) => printed.push(util.format(...args));
    });
    return printed;
  };

  it('prints a Sharetribe SDK error with its token when nothing redacts it', () => {
    expect(util.inspect(apiError)).toContain(TOKEN);
    expect(util.inspect(networkError)).toContain(TOKEN);
  });

  it('describes a Sharetribe SDK error by status and API error codes only', () => {
    const described = log.describeError(apiError);

    expect(described).toMatchObject({
      status: 409,
      apiErrors: [{ status: 409, code: 'conflict-missing-key' }],
    });
    expect(util.inspect(described, { depth: null })).not.toContain(TOKEN);
    expect(util.inspect(log.describeError(networkError), { depth: null })).not.toContain(TOKEN);
    expect(log.describeError(networkError).code).toBe('ECONNREFUSED');
  });

  it('leaves other errors as they are, stack included', () => {
    const error = new Error('render failed');

    expect(log.describeError(error)).toBe(error);
  });

  it('keeps the token out of log.error output', () => {
    const printed = captureConsole();

    log.error(apiError, 'local-api-request-failed', apiError.data);

    expect(printed.join('\n')).not.toContain(TOKEN);
    expect(printed.join('\n')).toContain('conflict-missing-key');
  });

  it('keeps the token out of errors passed straight to console', () => {
    const printed = captureConsole();
    log.redactHttpErrorsInConsole();

    console.error('Request failed:', apiError);
    console.warn(networkError);
    console.log('plain', { id: 1 });

    expect(printed.join('\n')).not.toContain(TOKEN);
    expect(printed[0]).toContain('conflict-missing-key');
    expect(printed[1]).toContain('ECONNREFUSED');
    expect(printed[2]).toBe('plain { id: 1 }');
  });
});
