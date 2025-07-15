import EventEmitter from 'node:events';
import { shortId } from '../utils';

interface FlowEvent {
  type: string;
  sender?: FlowNode;
  args: unknown[];
}

interface FlowTaskArgs {
  emit: (event: string, ...args: unknown[]) => void;
  next: (...args: unknown[]) => void;
  event: FlowEvent;
}

export class Flow extends EventEmitter {
  private startNode: FlowNode | null = null;

  node() {
    this.startNode = new FlowNode(this);
    return this.startNode;
  }
  async run() {
    if (!this.startNode) {
      return;
    }
    const ret = new Promise(resolve => {
      this.once('finish', () => {
        resolve(null);
      });
    });
    this.startNode.emitter.emit(this.startNode.nextEventType, {
      type: this.startNode.nextEventType,
      sender: null,
      args: [],
    });

    return ret;
  }
}

/* 
  const node = flow.node();
  const nextNode = node.execute(({emit, next, event}) => {
    emit('event',...eventArgs);
    next(1, 2, 3);
  });
  nextNode.execute(({emit, next, event}) => {
    ...
  });

  await flow.run();
*/

export class FlowNode {
  private id = shortId();
  public emitter = new EventEmitter(); // 事件发射器

  constructor(
    private flow: Flow,
    private previousNode: FlowNode | null = null
  ) {}

  finish() {
    this.on(
      this.nextEventType,
      () => {
        this.flow.emit('finish');
      },
      true
    );
  }

  on(event: string, listener: (taskArgs: FlowTaskArgs) => any, once: boolean = false) {
    const nextNode = new FlowNode(this.flow, this); // 下一个节点
    const listen = once ? 'once' : 'on';
    let callNext = false;
    this.emitter[listen](event, async (event: FlowEvent) => {
      const ret = await listener({
        emit: (event: string, ...args: unknown[]) => {
          if (nextNode) {
            nextNode.emitter.emit(event, {
              type: event,
              sender: this,
              args,
            });
          }
        },
        next: (...args: unknown[]) => {
          callNext = true;
          if (!nextNode) {
            return;
          }
          return nextNode.emitter.emit(nextNode.nextEventType, {
            type: nextNode.nextEventType,
            sender: this,
            args,
          });
        },
        event,
      });
      if (!callNext && nextNode) {
        return nextNode.emitter.emit(nextNode.nextEventType, {
          type: nextNode.nextEventType,
          sender: this,
          args: ret ? [ret] : [],
        });
      }
    });
    return nextNode;
  }

  get nextEventType() {
    return `$$NEXT$$_${this.id}`;
  }

  execute(task: (arg0: FlowTaskArgs) => void): FlowNode {
    const nextNode = this.on(this.nextEventType, task, true);
    return nextNode;
  }
}
