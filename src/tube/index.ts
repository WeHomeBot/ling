import EventEmitter from 'node:events';
import { shortId } from "../utils";

export class Tube extends EventEmitter {
  private _stream: ReadableStream;
  private controller: ReadableStreamDefaultController | null = null;
  private _canceled: boolean = false;
  private _closed: boolean = false;
  private _sse: boolean = false;
  private messageIndex = 0;
  private filters: Record<string, ((data: unknown) => boolean)[]> = {};

  constructor(private session_id: string = shortId()) {
    super();
    const self = this;
    this._stream = new ReadableStream({
      start(controller) {
        self.controller = controller;
      }
    });
  }

  addFilter(bot_id: string, filter: (data: any) => boolean) {
    this.filters[bot_id] = this.filters[bot_id] || [];
    this.filters[bot_id].push(filter);
  }

  clearFilters(bot_id: string) {
    this.filters[bot_id] = [];
  }

  setSSE(sse: boolean) {
    this._sse = sse;
  }

  enqueue(data: unknown, isQuiet: boolean = false, bot_id?: string) {
    const isFiltered = bot_id && this.filters[bot_id]?.some(filter => filter(data));
    const id = `${this.session_id}:${this.messageIndex++}`;
    if (!this._closed) {
      try {
        if(typeof data !== 'string') {
          if(this._sse && (data as any)?.event) {
            const event = `event: ${(data as any).event}\n`
            if(!isQuiet && !isFiltered) this.controller?.enqueue(event);
            this.emit('message', {id, data: event});
            if((data as any).event === 'error') {
              this.emit('error', {id, data});
            }
          }
          data = JSON.stringify(data) + '\n'; // use jsonl (json lines)
        }
        if(this._sse) {
          data = `data: ${(data as string).replace(/\n$/,'')}\nid: ${id}\n\n`;
        }
        if(!isQuiet && !isFiltered) this.controller?.enqueue(data);
        this.emit('message', {id, data});
      } catch(ex: any) {
        this._closed = true;
        this.emit('error', {id, data: ex.message});
        console.error('enqueue error:', ex);
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
