import { JSONParser } from './json.parser';

describe('JSONParser', () => {
  let parser: JSONParser;

  beforeEach(() => {
    parser = new JSONParser({
      parentPath: 'x/y',
      debug: false,
    });
  });

  test('sample JSON string {}', done => {
    const _data = {};

    parser.on('finish', (data) => {
      expect(data).toEqual(_data);
      done();
    });

    parser.trace(JSON.stringify(_data));
  })

  test('sample JSON string []', done => {
    const _data: any = [];

    parser.on('finish', (data) => {
      expect(data).toEqual(_data);
      done();
    });

    parser.trace(JSON.stringify(_data));
  })

  test('sample JSON string Object', done => {
    const _arr: string[] = [];
    const _data = { "name": "bearbobo" };

    parser.on('data', (data) => {
      _arr.push(data.delta)
    });
    parser.on('finish', (data) => {
      expect(data).toEqual(_data);
      expect(_arr).toEqual(['b', 'e', 'a', 'r', 'b', 'o', 'b', 'o']);
      done();
    });

    parser.trace(JSON.stringify(_data));
  })

  test('sample JSON string Number', done => {
    const _arr: any[] = [];
    const _data = { "age": 10 };

    parser.on('data', (data) => {
      _arr.push(data)
    });
    parser.on('finish', (data) => {
      expect(data).toEqual(_data);
      expect(_arr).toEqual([{ uri: 'x/y/age', delta: 10 }]);
      done();
    });

    parser.trace(JSON.stringify(_data));
  })

  test('sample JSON string Boolean', done => {
    const _arr: any[] = [];
    const _data = { a: false, b: true, c: true };

    parser.on('data', (data) => {
      _arr.push(data)
    });
    parser.on('finish', (data) => {
      expect(data).toEqual(_data);
      expect(_arr).toEqual([{ uri: 'x/y/a', delta: false }, { uri: 'x/y/b', delta: true }, { uri: 'x/y/c', delta: true }]);
      done();
    });

    parser.trace(JSON.stringify(_data));
  })

  test('sample JSON object and array', done => {
    const _data = { "a": [1, 2, 3], "b": { "c": 4, "d": 5 } };
    parser.on('object-resolve', ({uri, delta}) => {
      console.log('object-resolve', uri, delta);
      if(uri === 'a') {
        expect(delta).toEqual([1, 2, 3]);
      }
      if(uri === 'b') {
        expect(delta).toEqual({c: 4, d: 5});
      }
    })
    parser.on('finish', (data) => {
      expect(data).toEqual(_data);
      done();
    });
    parser.trace(JSON.stringify(_data));
  })

  test('complex JSON string', done => {
    const _arr: any[] = [];
    const _data = { "b": { "a\"": "你好，我是波波熊。" }, "c": 1024, "d": true, "e": [1, 2, " 灵", true, false, null, [32], { 'g': 'h' }], "f": null };

    parser.on('data', (data) => {
      _arr.push(data)
    });
    parser.on('finish', (data) => {
      expect(data).toEqual(_data);
      expect(_arr).toEqual([
        { uri: 'x/y/b/a\\"', delta: '你' },
        { uri: 'x/y/b/a\\"', delta: '好' },
        { uri: 'x/y/b/a\\"', delta: '，' },
        { uri: 'x/y/b/a\\"', delta: '我' },
        { uri: 'x/y/b/a\\"', delta: '是' },
        { uri: 'x/y/b/a\\"', delta: '波' },
        { uri: 'x/y/b/a\\"', delta: '波' },
        { uri: 'x/y/b/a\\"', delta: '熊' },
        { uri: 'x/y/b/a\\"', delta: '。' },
        { uri: 'x/y/c', delta: 1024 },
        { uri: 'x/y/d', delta: true },
        { uri: 'x/y/e/0', delta: 1 },
        { uri: 'x/y/e/1', delta: 2 },
        { uri: 'x/y/e/2', delta: ' ' },
        { uri: 'x/y/e/2', delta: '灵' },
        { uri: 'x/y/e/3', delta: true },
        { uri: 'x/y/e/4', delta: false },
        { uri: 'x/y/e/5', delta: null },
        { uri: 'x/y/e/6/0', delta: 32 },
        { uri: 'x/y/e/7/g', delta: 'h' },
        { uri: 'x/y/f', delta: null }
      ]);
      done();
    });

    parser.trace(JSON.stringify(_data));
  });

  test('invalid JSON string', done => {
    try {
      parser.trace('bearbobo');
    } catch (error: any) {
      expect(error.message).toBe('Invalid Token');
      done();
    }
  });

  test('Minimum valid JSON string', done => {
    const _arr: any[] = [];
    const _data = { "k": "v" };

    parser.on('data', (data) => {
      expect(data.uri.startsWith('x/y')).toBeTruthy();
      _arr.push(data)
    });
    parser.on('finish', (data) => {
      expect(data).toEqual(_data);
      expect(_arr).toEqual([{ uri: 'x/y/k', delta: 'v' }]);
      done();
    });

    parser.trace(JSON.stringify(_data));
  });

  test('sample JSON string with space', done => {
    parser.on('finish', (data) => {
      expect(data).toEqual({ 'name': 'bearbobo', 'age': 10, boy: true, hobbies: ['football', 'swiming'], school: null });
      done();
    })
    parser.trace('{ "name" : "bearbobo" , "age" : 10 , "boy" : true , "hobbies" : [ "football", "swiming" ] , "school" : null } ');
  });

  test('Empty JSON string', done => {
    try {
      parser.trace('');
    } catch (error: any) {
      expect(error.message).toBe('Invalid Token');
      done();
    }
  });

  // Currently, JSONL is not supported
  test('JSONL', done => {
    try {
      parser.trace(`{"name":"bearbobo"}
{"name":"ling"}`);
    } catch (error: any) {
      expect(error.message).toBe('Invalid Token');
      done();
    }
  });

  test('JSON string with number key', done => {
    try {
      parser.trace('{1: "bearbobo"}');
    } catch (error: any) {
      expect(error.message).toBe('Invalid Token');
      done();
    }
  });

  test('JSON string without quotation marks', done => {
    try {
      parser.trace('{name:bearbobo}');
    } catch (error: any) {
      expect(error.message).toBe('Invalid Token');
      done();
    }
  });

  test('JSON string containing illegal characters', done => {
    try {
      parser.trace(`{'name':"John"}`);
    } catch (error: any) {
      expect(error.message).toBe('Invalid Token');
      done();
    }
  });

  test('JSON string with illegal boolean value', done => {
    try {
      parser.trace('{"name":truae}');
    } catch (error: any) {
      expect(error.message).toBe('Invalid Token');
      done();
    }
  });

  test('JSON string with undefined value', done => {
    try {
      parser.trace('{"name":undefined}');
    } catch (error: any) {
      expect(error.message).toBe('Invalid Token');
      done();
    }
  });

  // TODO: JSON string with mismatched parentheses will not emit finish event
  // test('JSON string with mismatched parentheses', done => {
  //   try {
  //     parser.trace('{"name":"bearbobo"');
  //   } catch (error: any) {
  //     expect(error.message).toBe('Invalid Token');
  //     done();
  //   }
  // }, 1000);

  test('JSON string containing illegal characters', done => {
    try {
      parser.trace('{"name":"Bearbobo\n"}');
    } catch (error: any) {
      expect(error.message).toBe('Invalid Token');
      done();
    }
  });

  // TODO: Duplicate keys will be overwritten in the finish event, but will be retained in the data event
  test('JSON string with duplicate key', done => {
    const _arr: any[] = [];

    parser.on('data', (data) => {
      _arr.push(data)
    });
    parser.on('finish', (data) => {
      expect(data).toEqual({ a: 2048 });
      expect(_arr).toEqual([{ uri: 'x/y/a', delta: 1024, }, { uri: 'x/y/a', delta: 2048 }]);
      done();
    });

    parser.trace('{"a": 1024, "a": 2048}');
  });

  test('JSON autoFix extra quotation marks of key 1', done => {
    // 多一个右引号
    const parser = new JSONParser({
      debug: false,
      autoFix: true,
    });
    const input = `{
      "name"": "bearbobo",
      "age" : 10
    }`;
    // parser.on('data', (data) => { 
    //   console.log(data);
    // });
    parser.on('finish', (data) => {
      expect(data).toEqual({name: 'bearbobo', age: 10});
      done();
    });
    parser.trace(input);
  });

  test('JSON autoFix extra quotation marks of key 2', done => {
    // 多一个左引号
    const parser = new JSONParser({
      debug: false,
      autoFix: true,
    });
    const input = `{
      ""name": "bearbobo",
      "age" : 10
    }`;
    // parser.on('data', (data) => { 
    //   console.log(data);
    // });
    parser.on('finish', (data) => {
      expect(data).toEqual({name: 'bearbobo', age: 10});
      done();
    });
    parser.trace(input);
  });

  test('JSON autoFix extra quotation marks of key 3', done => {
    // key 中间多了引号，后面的内容忽略，注意这里和 jsonrepaire 逻辑不一样，不做转义替换
    const parser = new JSONParser({
      debug: false,
      autoFix: true,
    });
    const input = `{
      "name"abc": "bearbobo",
      "age" : 10
    }`;
    // parser.on('data', (data) => { 
    //   console.log(data);
    // });
    parser.on('finish', (data) => {
      expect(data).toEqual({name: 'bearbobo', age: 10});
      done();
    });
    parser.trace(input);
  });

  test('JSON autoFix lost quotation marks of key 1', done => {
    // 缺失右引号
    const parser = new JSONParser({
      debug: false,
      autoFix: true,
    });
    const input = `{
      "name" : "bearbobo",
      "age : 10
    }`;
    // parser.on('data', (data) => { 
    //   console.log(data);
    // });
    parser.on('finish', (data) => {
      expect(data).toEqual({"name": 'bearbobo', age: 10});
      done();
    });
    parser.trace(input);
  });

  test('JSON autoFix lost quotation marks of key 2', done => {
    // 缺失左引号
    const parser = new JSONParser({
      debug: false,
      autoFix: true,
    });
    const input = `{
      "name" : "bearbobo",
      age" : 10
    }`;
    // parser.on('data', (data) => { 
    //   console.log(data);
    // });
    parser.on('finish', (data) => {
      expect(data).toEqual({"name": 'bearbobo', age: 10});
      done();
    });
    parser.trace(input);
  });

  test('JSON autoFix lost quotation marks of key 3', done => {
    // 两个引号都缺失
    const parser = new JSONParser({
      debug: false,
      autoFix: true,
    });
    const input = `{
      "name" : "bearbobo",
      age : 10
    }`;
    // parser.on('data', (data) => { 
    //   console.log(data);
    // });
    parser.on('finish', (data) => {
      expect(data).toEqual({"name": 'bearbobo', age: 10});
      done();
    });
    parser.trace(input);
  });

  test('JSON autoFix lost quotation marks of key 4', done => {
    // 整个key丢失
    const parser = new JSONParser({
      debug: false,
      autoFix: true,
    });
    const input = `{
      "name" : "bearbobo",
       : 10
    }`;
    // parser.on('data', (data) => { 
    //   console.log(data);
    // });
    parser.on('finish', (data) => {
      expect(data).toEqual({"name": 'bearbobo', "": 10});
      done();
    });
    parser.trace(input);
  });

  test('JSON autoFix ignore key line break', done => {
    // key中的回车符
    const parser = new JSONParser({
      debug: false,
      autoFix: true,
    });
    const input = `{
      "na
me" : "bearbobo",
      "age" : 10
    }`;
    // parser.on('data', (data) => { 
    //   console.log(data);
    // });
    parser.on('finish', (data) => {
      expect(data).toEqual({"name": 'bearbobo', "age": 10});
      done();
    });
    parser.trace(input);
  });

  test('JSON autoFix ignore value line break', done => {
    // key中的回车符
    const parser = new JSONParser({
      debug: false,
      autoFix: true,
    });
    const input = `{
      "name" : "bearbobo",
      "age" : 10,
      "content" : "hello
world"
    }`;
    // parser.on('data', (data) => { 
    //   console.log(data);
    // });
    parser.on('finish', (data) => {
      expect(data).toEqual({"name": 'bearbobo', "age": 10, "content": "hello\nworld"});
      done();
    });
    parser.trace(input);
  });

  test('JSON autoFix lost value', done => {
    const parser = new JSONParser({
      debug: false,
      autoFix: true,
    });
    const input = `{
      "name" : ,
      "age" : 
    }`;
    // parser.on('data', (data) => { 
    //   console.log(data);
    // });
    parser.on('finish', (data) => {
      expect(data).toEqual({"name": null, "age": null});
      done();
    });
    parser.trace(input);
  });

  test('JSON autoFix lost quotation marks of string value 1', done => {
    // 缺少左引号
    const parser = new JSONParser({
      debug: false,
      autoFix: true,
    });
    const input = `{
      "name" : bearbobo",
      "age" : 10
    }`;
    // parser.on('data', (data) => { 
    //   console.log(data);
    // });
    parser.on('finish', (data) => {
      expect(data).toEqual({"name": 'bearbobo', "age": 10});
      done();
    });
    parser.trace(input);
  });

  test('JSON autoFix lost quotation marks of string value 1', done => {
    // 缺少右引号
    const parser = new JSONParser({
      debug: false,
      autoFix: true,
    });
    const input = `{
      "name" : "bearbobo,
      "age" : 10
    }`;
    // parser.on('data', (data) => { 
    //   console.log(data);
    // });
    parser.on('finish', (data) => {
      expect(data).toEqual({"name": 'bearbobo', "age": 10});
      done();
    });
    parser.trace(input);
  });

  test('JSON autoFix extra quotation marks of string value 1', done => {
    // 缺少右引号
    const parser = new JSONParser({
      debug: false,
      autoFix: true,
    });
    const input = `{
      "name" : "be"a
rbo"bo,
      "age" : 10
    }`;
    // parser.on('data', (data) => { 
    //   console.log(data);
    // });
    parser.on('finish', (data) => {
      expect(data).toEqual({"name": 'be\"a\nrbo\"bo', "age": 10});
      done();
    });
    parser.trace(input);
  });

  test('JSON autoFix incorrect quotation marks 1', done => {
    // 不正确的引号
    const parser = new JSONParser({
      debug: false,
      autoFix: true,
    });
    const input = `{
      'name" : "bearbobo",
      "age" : 10
    }`;
    parser.on('finish', (data) => {
      expect(data).toEqual({"name": 'bearbobo', "age": 10});
      done();
    });
    parser.trace(input);
  });

  test('JSON autoFix incorrect quotation marks 2', done => {
    // 不正确的引号
    const parser = new JSONParser({
      debug: false,
      autoFix: true,
    });
    const input = `{
      "name” : "bearbobo",
      "age" : 10
    }`;
    parser.on('finish', (data) => {
      expect(data).toEqual({"name": 'bearbobo', "age": 10});
      done();
    });
    parser.trace(input);
  });

  test('JSON autoFix incorrect quotation marks 3', done => {
    // 不正确的引号 - 这里不做处理
    const parser = new JSONParser({
      debug: false,
      autoFix: true,
    });
    const input = `{
      "name” : ‘bearbobo',
      "age" : 10
    }`;
    parser.on('finish', (data) => {
      expect(data).toEqual({"name": '‘bearbobo\'', "age": 10});
      done();
    });
    parser.trace(input);
  });

  test('JSON autoFix incorrect quotation marks 4', done => {
    // 当作漏掉引号处理
    const parser = new JSONParser({
      debug: false,
      autoFix: true,
    });
    const input = `{
      "name” : nul,
      "0text" : true,
      "age" : 10a,
      "school" : [1, 2, 3]
    }`;
    // parser.on('data', (data) => { 
    //   console.log(data);
    // });
    parser.on('finish', (data) => {
      expect(data).toEqual({"name": "nul", "0text": true, "age": "10a", "school": [1, 2, 3]});
      done();
    });
    parser.trace(input);
  });

  test('JSON string with emoji', done => {
    const parser = new JSONParser({
      debug: false,
      autoFix: true,
    });
    const input = `{
      "name” : "🐻"
    }`;
    parser.on('finish', (data) => {
      expect(data).toEqual({"name": "🐻"});
      done();
    });
    parser.trace(input);
  });

  test('JSON string with escape character', done => {
    const parser = new JSONParser({
      debug: false,
      autoFix: true,
    });
    const input = `{
      "name” : "bear\\"bobo\\ntest"
    }`;
    parser.on('data', (data) => {
      console.log('escape character', data);
    });
    parser.on('string-resolve', (data) => {
      console.log('string-resolve', data);
    });
    parser.on('finish', (data) => {
      expect(data).toEqual({"name": "bear\"bobo\ntest"});
      done();
    });
    parser.trace(input);
  });

  test('JSON with other text', done => {
    // 当作漏掉引号处理
    const parser = new JSONParser({
      debug: false,
      autoFix: true,
    });
    const input = `我们可以输出如下JSON数据：
    \`\`\`json
    {
      "name” : nul,
      "0text" : true,
      "age" : 10a,
      "school" : [1, 2, 3]
    }
    \`\`\``;
    parser.on('data', (data) => { 
      console.log(data);
    });
    parser.on('finish', (data) => {
      expect(data).toEqual({"name": "nul", "0text": true, "age": "10a", "school": [1, 2, 3]});
      done();
    });
    parser.trace(input);
  });
})
