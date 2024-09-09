export class Tube {
  private _stream: ReadableStream;
  private controller: ReadableStreamDefaultController | null = null;
  private _canceled: boolean = false;

  constructor() {
    const self = this;
    this._stream = new ReadableStream({
      start(controller) {
        self.controller = controller;
      }
    });
  }

  enqueue(data: any) {
    if (!this.canceled) {
      this.controller?.enqueue(data);
    }
  }

  close() {
    this.controller?.close();
  }

  cancel() {
    this._canceled = true;
    this.stream.cancel();
  }

  get canceled() {
    return this._canceled;
  }

  get stream() {
    return this._stream;
  }
}
