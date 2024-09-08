import { JSONParser } from './index';

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

  // 无效等价类
  test('invalid JSON string', done => {
    try {
      parser.trace('bearbobo');
    } catch (error: any) {
      expect(error.message).toBe('Invalid TOKEN');
      done();
    }
  });

  // 边界值分析

  // 最小的有效输入
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

  // 带有空格的JSON字符串
  test('sample JSON string with space', done => {
    parser.on('finish', (data) => {
      expect(data).toEqual({ 'name': 'bearbobo', 'age': 10, boy: true, hobbies: ['football', 'swiming'], school: null });
      done();
    })
    parser.trace('{ "name" : "bearbobo" , "age" : 10 , "boy" : true , "hobbies" : [ "football", "swiming" ] , "school" : null } ');
  });


  // 错误推测
  test('Empty JSON string', done => {
    try {
      parser.trace('');
    } catch (error: any) {
      expect(error.message).toBe('Invalid TOKEN');
      done();
    }
  });

  // Currently, JSONL is not supported
  test('JSONL', done => {
    try {
      parser.trace(`{"name":"bearbobo"}
{"name":"ling"}`);
    } catch (error: any) {
      expect(error.message).toBe('Invalid TOKEN');
      done();
    }
  });

  test('JSON string with number key', done => {
    try {
      parser.trace('{1: "bearbobo"}');
    } catch (error: any) {
      expect(error.message).toBe('Invalid TOKEN');
      done();
    }
  });

  test('JSON string without quotation marks', done => {
    try {
      parser.trace('{name:bearbobo}');
    } catch (error: any) {
      expect(error.message).toBe('Invalid TOKEN');
      done();
    }
  });

  test('JSON string containing illegal characters', done => {
    try {
      parser.trace(`{'name':"John"}`);
    } catch (error: any) {
      expect(error.message).toBe('Invalid TOKEN');
      done();
    }
  });

  test('JSON string with illegal boolean value', done => {
    try {
      parser.trace('{"name":truae}');
    } catch (error: any) {
      expect(error.message).toBe('Invalid TOKEN');
      done();
    }
  });

  test('JSON string with undefined value', done => {
    try {
      parser.trace('{"name":undefined}');
    } catch (error: any) {
      expect(error.message).toBe('Invalid TOKEN');
      done();
    }
  });

  // test('JSON string with mismatched parentheses', done => {
  //   try {
  //     parser.trace('{"name":"bearbobo"');
  //   } catch (error: any) {
  //     expect(error.message).toBe('Invalid TOKEN');
  //     done();
  //   }
  // }, 1000);

  test('JSON string containing illegal characters', done => {
    try {
      parser.trace('{"name":"Bearbobo\n"}');
    } catch (error: any) {
      expect(error.message).toBe('Invalid TOKEN');
      done();
    }
  });
})
