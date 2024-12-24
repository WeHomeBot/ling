import EventEmitter from 'node:events';
import merge from 'lodash.merge';

import { ChatBot, Bot } from './bot/index';
import { Tube } from './tube';
import type { ChatConfig, ChatOptions } from "./types";
import { sleep, shortId } from './utils';

export type { ChatConfig, ChatOptions } from "./types";
export type { Tube } from "./tube";

export { Bot, ChatBot, WorkState } from "./bot";

export class Ling extends EventEmitter {
  protected _tube: Tube;
  protected customParams: Record<string, string> = {};
  protected bots: Bot[] = [];
  protected session_id = shortId();
  private _promise: Promise<any> | null = null;

  constructor(protected config: ChatConfig, protected options: ChatOptions = {}) {
    super();
    if(config.session_id) {
      this.session_id = config.session_id;
      delete config.session_id;
    }
    this._tube = new Tube(this.session_id);
    this._tube.on('message', (message) => {
      this.emit('message', message);
    });
    this._tube.on('finished', () => {
      this.emit('finished');
    });
    this._tube.on('canceled', () => {
      this.emit('canceled');
    });
    // this._tube.on('error', (error) => {
    //   this.emit('error', error);
    // });
  }

  get promise() {
    if(!this._promise) {
      this._promise = new Promise((resolve, reject) => {
        let result: any = {};
        this.on('inference-done', (content, bot) => {
          let output = bot.isJSONFormat() ? JSON.parse(content) : content;
          if(bot.root != null) {
            result[bot.root] = output;
          } else {
            result = merge(result, output);
          }
        });
        this.once('finished', () => {
          resolve(result);
        });
        this.once('error', (error, bot) => {
          reject(error);
        });
      });
    }
    return this._promise;
  }

  createBot(root: string | null = null, config: Partial<ChatConfig> = {}, options: Partial<ChatOptions> = {}) {
    const bot = new ChatBot(this._tube, {...this.config, ...config}, {...this.options, ...options});
    bot.setJSONRoot(root);
    bot.setCustomParams(this.customParams);
    bot.addListener('error', (error) => {
      this.emit('error', error, bot);
    });
    bot.addListener('inference-done', (content) => {
      this.emit('inference-done', content, bot);
    });
    this.bots.push(bot);
    return bot;
  }

  addBot(bot: Bot) {
    this.bots.push(bot);
  }

  setCustomParams(params: Record<string, string>) {
    this.customParams = {...params};
  }

  setSSE(sse: boolean) {
    this._tube.setSSE(sse);
  }

  protected isAllBotsFinished() {
    return this.bots.every(bot => bot.state === 'finished' || bot.state === 'error');
  }

  async close() {
    while (!this.isAllBotsFinished()) {
      await sleep(100);
    }
    await sleep(500); // 再等0.5秒，确保没有新的 bot 创建，所有 bot 都真正结束
    if(!this.isAllBotsFinished()) {
      this.close(); // 如果还有 bot 没有结束，则再关闭一次
      return;
    }
    this._tube.close();
    this.bots = [];
  }

  async cancel() {
    while (!this.isAllBotsFinished()) {
      await sleep(100);
    }
    this._tube.cancel();
    this.bots = [];
  }

  sendEvent(event: any) {
    this._tube.enqueue(event);
  }

  get tube() {
    return this._tube;
  }

  get model() {
    return this.config.model_name;
  }

  get stream() {
    return this._tube.stream;
  }

  get canceled() {
    return this._tube.canceled;
  }

  get closed() {
    return this._tube.closed;
  }

  get id() {
    return this.session_id;
  }
}
