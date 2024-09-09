import { Tube } from './index';

describe('Tube', () => {
  let tube: Tube;

  beforeEach(() => {
    tube = new Tube();
  });

  test('sample tube', done => {
    const _arr: any[] = [];

    tube.enqueue('a');
    tube.enqueue('b');
    tube.enqueue('c');
    tube.enqueue('d');
    tube.enqueue('e');
    tube.enqueue('f');
    tube.enqueue('g');
    tube.enqueue('h');
    tube.enqueue('i');
    tube.enqueue('j');
    tube.enqueue('k');
    tube.enqueue('l');
    tube.enqueue('m');
    tube.enqueue('n');
    tube.enqueue('o');
    tube.enqueue('p');
    tube.enqueue('q');
    tube.enqueue('r');
    tube.enqueue('s');
    tube.enqueue('t');
    tube.enqueue('u');
    tube.enqueue('v');
    tube.enqueue('w');
    tube.enqueue('x');
    tube.enqueue('y');
    tube.enqueue('z');

    tube.close();

    const reader = tube.stream.getReader();
    reader.read().then(function processText({ done:_done, value }) : any {
      if (_done) {
        expect(_arr).toEqual(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z']);
        done();
        return;
      }
      _arr.push(value);
      return reader.read().then(processText);
    });
  });

  test('cancel tube', done => {
    const _arr: any[] = [];

    tube.enqueue('a');
    tube.enqueue('b');
    tube.enqueue('c');
    tube.enqueue('d');
    tube.enqueue('e');
    tube.enqueue('f');
    tube.enqueue('g');
    tube.enqueue('h');
    tube.enqueue('i');
    tube.enqueue('j');
    tube.enqueue('k');
    tube.enqueue('l');
    tube.enqueue('m');
    tube.enqueue('n');
    tube.enqueue('o');
    tube.enqueue('p');
    tube.enqueue('q');
    tube.enqueue('r');
    tube.enqueue('s');
    tube.enqueue('t');
    tube.enqueue('u');
    tube.enqueue('v');
    tube.enqueue('w');
    tube.enqueue('x');
    tube.enqueue('y');
    tube.enqueue('z');

    tube.cancel();

    const reader = tube.stream.getReader();
    reader.read().then(function processText({ done:_done, value }) : any {
      if (_done) {
        expect(_arr).toEqual([]);
        done();
        return;
      }
      _arr.push(value);
      return reader.read().then(processText);
    });
  });
})