import EventEmitter from 'node:events';

import { Bot } from './bot/index';
import { Tube } from './tube';
import type { ChatConfig, ChatOptions } from "./types";
import { sleep, shortId } from './utils';

export class Ling extends EventEmitter {
  private tube: Tube;
  private customParams: Record<string, string> = {};
  private bots: Bot[] = [];
  private session_id = shortId();

  constructor(private config: ChatConfig, private options: ChatOptions = {}) {
    super();
    if(config.session_id) {
      this.session_id = config.session_id;
      delete config.session_id;
    }
    this.tube = new Tube(this.session_id);
    this.tube.on('message', (message) => {
      this.emit('message', message);
    });
    this.tube.on('finished', () => {
      this.emit('finished');
    });
    this.tube.on('canceled', () => {
      this.emit('canceled');
    });
  }

  createBot(root: string | null = null, config: Partial<ChatConfig> = {}, options: Partial<ChatOptions> = {}) {
    const bot = new Bot(this.tube, {...this.config, ...config}, {...this.options, ...options});
    bot.setJSONRoot(root);
    bot.setCustomParams(this.customParams);
    this.bots.push(bot);
    return bot;
  }

  setCustomParams(params: Record<string, string>) {
    this.customParams = {...params};
  }

  setSSE(sse: boolean) {
    this.tube.setSSE(sse);
  }

  private isAllBotsFinished() {
    return this.bots.every(bot => bot.state === 'finished');
  }

  async close() {
    while (!this.isAllBotsFinished()) {
      await sleep(100);
    }
    this.tube.close();
    this.bots = [];
  }

  async cancel() {
    while (!this.isAllBotsFinished()) {
      await sleep(100);
    }
    this.tube.cancel();
    this.bots = [];
  }

  sendEvent(event: any) {
    this.tube.enqueue(event);
  }

  get stream() {
    return this.tube.stream;
  }

  get canceled() {
    return this.tube.canceled;
  }

  get closed() {
    return this.tube.closed;
  }

  get id() {
    return this.session_id;
  }
}
