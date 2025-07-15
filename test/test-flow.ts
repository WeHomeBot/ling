import { Flow } from '../src/flow/index';

(async () => {
  const flow = new Flow();
  const node = flow.node();
  const nextNode = node.execute(({ emit, next, event }) => {
    emit('event', ...event.args);
    next(1, 2, 3);
  });
  nextNode.execute(() => {
    console.log('1111');
  });
  nextNode
    .execute(async ({ emit, next, event }) => {
      console.log(event.args);
      return [4, 5, 6];
    })
    .execute(({ event }) => {
      console.log(event.args);
    })
    .finish();

  console.log('start');
  await flow.run();
  console.log('done');
  // nul
})();
