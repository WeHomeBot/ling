import { Flow } from './index';

describe('Flow', () => {
  let flow: Flow;

  beforeEach(() => {
    flow = new Flow();
  });

  test('创建Flow实例', () => {
    expect(flow).toBeInstanceOf(Flow);
  });

  test('创建节点', () => {
    const node = flow.node();
    expect(node).toBeDefined();
  });

  test('基本节点执行', async () => {
    const mockFn = jest.fn();
    const node = flow.node();
    node.execute(({ next }) => {
      mockFn();
      next();
    });

    await flow.run();
    expect(mockFn).toHaveBeenCalled();
  });

  test('链式节点执行', async () => {
    const results: number[] = [];
    const node = flow.node();
    
    node.execute(({ next }) => {
      results.push(1);
      next();
    })
    .execute(({ next }) => {
      results.push(2);
      next();
    })
    .execute(({ next }) => {
      results.push(3);
      next();
    })
    .finish();

    await flow.run();
    expect(results).toEqual([1, 2, 3]);
  });

  test('事件传递', async () => {
    const results: any[] = [];
    const node = flow.node();
    
    node.execute(({ next, emit }) => {
      emit('custom-event', 'data1');
      next('data2');
    })
    .on('custom-event', ({ event, next }) => {
      results.push(event.args[0]);
      next();
    })
    .execute(({ event, next }) => {
      results.push(event.args[0]);
      next();
    })
    .finish();

    await flow.run();
    expect(results).toEqual(['data1', 'data2']);
  });

  test('返回值传递', async () => {
    const results: any[] = [];
    const node = flow.node();
    
    node.execute(() => {
      return 'return-value';
    })
    .execute(({ event }) => {
      results.push(event.args[0]);
    })
    .finish();

    await flow.run();
    expect(results).toEqual(['return-value']);
  });

  test('异步节点执行', async () => {
    const results: number[] = [];
    const node = flow.node();
    
    node.execute(async ({ next }) => {
      await new Promise(resolve => setTimeout(resolve, 10));
      results.push(1);
      next();
    })
    .execute(async ({ next }) => {
      await new Promise(resolve => setTimeout(resolve, 10));
      results.push(2);
      next();
    })
    .finish();

    await flow.run();
    expect(results).toEqual([1, 2]);
  });

  test('完成事件', async () => {
    const finishMock = jest.fn();
    flow.on('finish', finishMock);
    
    const node = flow.node();
    node.execute(({ next }) => {
      next();
    })
    .finish();

    await flow.run();
    expect(finishMock).toHaveBeenCalled();
  });
});