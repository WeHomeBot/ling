import { JSONParser } from './parser/index';

// for test
const parser = new JSONParser();
const data = {"b": {"a": "你好，我是豆包。"}};
parser.on('data', (data) => {
  console.log(data);
});
parser.on('finish', (data) => {
  console.log('finish', data);
});
parser.trace(JSON.stringify(data));