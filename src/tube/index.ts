import EventEmitter from 'node:events';
import { shortId } from "../utils";

export class Tube extends EventEmitter {
  private _stream: ReadableStream;
  private controller: ReadableStreamDefaultController | null = null;
  private _canceled: boolean = false;
  private _closed: boolean = false;
  private _sse: boolean = false;
  private messageIndex = 0;
  private filters: ((data: unknown) => boolean)[] = [];

  constructor(private session_id: string = shortId()) {
    super();
    const self = this;
    this._stream = new ReadableStream({
      start(controller) {
        self.controller = controller;
      }
    });
  }

  addFilter(filter: ((data: unknown) => boolean) | string | RegExp) {
    if(typeof filter === 'string') {
      this.filters.push((data: any) => data.uri === filter);
    } else if(filter instanceof RegExp) {
      this.filters.push((data: any) => filter.test(data.uri));
    } else {
      this.filters.push(filter);
    }
  }

  setSSE(sse: boolean) {
    this._sse = sse;
  }

  enqueue(data: unknown, isQuiet: boolean = false) {
    const isFiltered = this.filters.some(filter => filter(data));
    const id = `${this.session_id}:${this.messageIndex++}`;
    if (!this._closed) {
      try {
        if(typeof data !== 'string') {
          if(this._sse && (data as any)?.event) {
            const event = `event: ${(data as any).event}\n`
            if(!isQuiet && !isFiltered) this.controller?.enqueue(event);
            this.emit('message', {id, data: event});
          }
          data = JSON.stringify(data) + '\n'; // use jsonl (json lines)
        }
        if(this._sse) {
          data = `data: ${(data as string).replace(/\n$/,'')}\nid: ${id}\n\n`;
        }
        if(!isQuiet && !isFiltered) this.controller?.enqueue(data);
        this.emit('message', {id, data});
      } catch(ex) {
        this._closed = true;
        // console.error('enqueue error:', ex);
      }
    }
  }

  close() {
    if(this._closed) return;
    this.enqueue({event: 'finished'});
    this.emit('finished');
    this._closed = true;
    if(!this._sse) this.controller?.close();
  }

  async cancel() {
    if(this._canceled) return;
    this._canceled = true;
    this._closed = true;
    try {
      this.enqueue({event: 'canceled'});
      this.emit('canceled');
      await this.stream.cancel();
    } catch(ex) {}
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
