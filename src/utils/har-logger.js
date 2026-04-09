import { writeFileSync, readFileSync, existsSync } from 'fs';

const HAR_VERSION = '1.2';
const CREATOR = { name: 'pega-dx-mcp', version: '1.0' };

/**
 * Singleton HAR (HTTP Archive) logger.
 * Activated by setting the HAR_LOG_FILE environment variable to a file path.
 * Each request/response pair is appended and the full HAR is flushed to disk.
 */
export class HarLogger {
  constructor(fileName) {
    this.filePath = process.env.LOG_DIRECTORY ? `${process.env.LOG_DIRECTORY}/${fileName}` : null;
    this.entries = [];

    if (this.filePath && existsSync(this.filePath)) {
      try {
        const existing = JSON.parse(readFileSync(this.filePath, 'utf8'));
        this.entries = existing?.log?.entries ?? [];
      } catch {
        this.entries = [];
      }
    }
  }

  get enabled() {
    return !!this.filePath;
  }

  /**
   * Log a single HTTP request/response exchange.
   *
   * @param {Object} opts
   * @param {string}  opts.method
   * @param {string}  opts.url
   * @param {Object}  opts.requestHeaders   - key/value header map (pre-send)
   * @param {string}  [opts.requestBody]    - raw request body string
   * @param {number}  opts.status
   * @param {string}  opts.statusText
   * @param {Object}  opts.responseHeaders  - key/value header map (from Response)
   * @param {*}       opts.responseBody     - already-parsed response body
   * @param {string}  opts.startedDateTime  - ISO timestamp of request start
   * @param {number}  opts.elapsed          - total ms
   */
  log({ method, url, requestHeaders, requestBody, status, statusText,
    responseHeaders, responseBody, startedDateTime, elapsed }) {
    if (!this.enabled) return;

    const parsedUrl = new URL(url);

    const entry = {
      startedDateTime,
      time: elapsed,
      request: {
        method: method.toUpperCase(),
        url,
        httpVersion: 'HTTP/1.1',
        headers: this._toHarHeaders(requestHeaders, ['authorization']),
        queryString: [...parsedUrl.searchParams.entries()].map(([name, value]) => ({ name, value })),
        cookies: [],
        headersSize: -1,
        bodySize: requestBody ? Buffer.byteLength(requestBody, 'utf8') : 0,
        ...(requestBody ? {
          postData: {
            mimeType: 'application/json',
            text: requestBody
          }
        } : {})
      },
      response: {
        status,
        statusText,
        httpVersion: 'HTTP/1.1',
        headers: this._toHarHeaders(responseHeaders),
        cookies: [],
        content: {
          mimeType: 'application/json',
          text: typeof responseBody === 'string' ? responseBody : JSON.stringify(responseBody),
          size: -1
        },
        redirectURL: '',
        headersSize: -1,
        bodySize: -1
      },
      cache: {},
      timings: {
        send: 0,
        wait: elapsed,
        receive: 0
      }
    };

    this.entries.push(entry);
    this._flush();
  }

  _toHarHeaders(headersObj, redactKeys = []) {
    if (!headersObj) return [];
    return Object.entries(headersObj).map(([name, value]) => ({
      name,
      value: redactKeys.includes(name.toLowerCase()) ? '[REDACTED]' : value
    }));
  }

  _flush() {
    const har = {
      log: {
        version: HAR_VERSION,
        creator: CREATOR,
        entries: this.entries
      }
    };
    try {
      writeFileSync(this.filePath, JSON.stringify(har, null, 2), 'utf8');
    } catch (err) {
      console.error(`[har-logger] Failed to write HAR file: ${err.message}`);
    }
  }
}
