export class Tube {
  private _stream: ReadableStream;
  private controller: ReadableStreamDefaultController | null = null;
  private _canceled: boolean = false;
  private _closed: boolean = false;

  constructor() {
    const self = this;
    this._stream = new ReadableStream({
      start(controller) {
        self.controller = controller;
      }
    });
  }

  enqueue(data: unknown) {
    if (!this._closed) {
      if(typeof data !== 'string') {
        data = JSON.stringify(data) + '\n'; // use jsonl (json lines)
      }
      this.controller?.enqueue(data);
    }
  }

  close() {
    this._closed = true;
    this.controller?.close();
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
