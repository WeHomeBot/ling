import { JSONParser } from './parser/index';

// for test
const parser = new JSONParser({
  autoFix: true,
  parentPath: 'x/y',
});
const data = {"b": {"a": "你好，我是豆包。"}, "c": 1024, "d": true, "e": null, "f": [1,2,[32], {'g': 'h'}]};
parser.on('data', (data) => {
  console.log(data);
});
parser.on('finish', (data) => {
  console.log('finish', data);
});
parser.trace(JSON.stringify(data));