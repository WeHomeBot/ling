export class Tube {
  private _stream: ReadableStream;
  private controller: ReadableStreamDefaultController | null = null;
  private _canceled: boolean = false;
  private _closed: boolean = false;
  private _sse: boolean = false;

  constructor(options = {sse: false}) {
    const self = this;
    this._stream = new ReadableStream({
      start(controller) {
        self.controller = controller;
      }
    });
    this._sse = options.sse;
  }

  setSSE(sse: boolean) {
    this._sse = sse;
  }

  enqueue(data: unknown, id: string) {
    if (!this._closed) {
      try {
        if(typeof data !== 'string') {
          if(this._sse && (data as any)?.event) {
            this.controller?.enqueue(`event: ${(data as any).event}\n`);
          }
          data = JSON.stringify(data) + '\n'; // use jsonl (json lines)
        }
        if(this._sse) {
          data = `data: ${data}\nid: ${id}\n\n`;
        }
        this.controller?.enqueue(data);
      } catch(ex) {
        this._closed = true;
        // console.error('enqueue error:', ex);
      }
    }
  }

  close() {
    if(this._closed) return;
    this._closed = true;
    if(!this._sse) this.controller?.close();
  }

  cancel() {
    this._canceled = true;
    this._closed = true;
    this.stream.cancel();
  }

  get canceled() {
    return this._canceled;
  }

  get closed() {
    return this._closed;
  }

  get stream() {
    return this._stream;
  }
}
