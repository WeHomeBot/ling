import { JSONParser } from './index';

test('default', done => {
  const parser = new JSONParser({
    parentPath: 'x/y',
    debug: false,
  });
  const _data = {"b": {"a": "你好，我是豆包。"}, "c": 1024, "d": true, "e": null, "f": [1,2,[32], {'g': 'h'}]};
  parser.on('data', (data) => {
    console.log(data);
    expect(data.uri.startsWith('x/y')).toBeTruthy();
  });
  parser.on('finish', (data) => {
    console.log('finish', data);
    expect(data).toEqual(_data);
    done();
  });
  parser.trace(JSON.stringify(_data));
});

test('one by one', done => {
  const parser = new JSONParser({
    parentPath: 'x/y',
    debug: false,
  });
  const _data = {"b": {"a": "你好，我是豆包。"}, "c": 1024, "d": true, "e": null, "f": [1,2,[32], {'g': 'h'}]};
  const tokens = JSON.stringify(_data).split('');

  parser.on('data', (data) => {
    console.log(data);
    expect(data.uri.startsWith('x/y')).toBeTruthy();
  });
  parser.on('finish', (data) => {
    console.log('finish', data);
    expect(data).toEqual(_data);
    done();
  });

  for(let i = 0; i < tokens.length; i++) {
    parser.trace(tokens[i]);
  }
});