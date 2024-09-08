import { JSONParser } from './index';

/**
 * 等价类划分，边界值分析，错误推测
 * 
 * 有效等价类：
 *  有效的简单 JSON 字符串
 *  - 输入值为 '{}' 时输出值为 {}
 *  - 输入值为 '[]' 时输出值为 []
 *  - 输入值为 '{"name":"bearbobo"}' 时输出值为 {"name":"bearbobo"}
 *  - 输入值为 '{"age": 10}' 时输出值为 {"age":10}
 *  - 输入值为 '{"boy": true}' 时输出值为 {"boy":true}
 * 有效的复杂 JSON 字符串
 *  - {"b": {"a\"": "你好，我是豆包。"}, "c": 1024, "d": true, "e": null, "f": [1,2,[32], {'g': 'h'}]}
 *  
 * 无效等价类：
 * 无效的 JSON 字符串
 *  - 输入值为 "bearbobo", true, false, 20240908.123, -20240908, 20240908, null 时抛出异常 Error('Invalid TOKEN')
 *  - 输入值为 '' (空JSON 字符串) 时抛出异常 Error('Invalid TOKEN')
 * 
 * 边界值分析：
 * 测试解析最小有效 JSON 字符串
 * - 输入值为 '{"k":"v"}' 时 输出值为 {"k":"v"}
 * 非常大的 JSON 字符串（假设包含大量嵌套和重复数据）
 * - 输入值（需要构造）时输出值为（需要构造）
 *   
 * 错误推测：
 * 缺少引号的 JSON 字符串
 * - 输出值为 '{name:bearbobo}' 时抛出异常 Error('Invalid TOKEN')
 * 括号不匹配的 JSON 字符串
 * - 输出值为 '{name:bearbobo' 时抛出异常 Error('Invalid TOKEN')
 * 包含非法字符的 JSON 字符串
 * - 输出值为 '{"name":"@John"}' 时抛出异常 Error('Invalid TOKEN')
 */

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
    const _arr: any = [];
    const _data = { "b": { "a\"": "你好，我是豆包。" }, "c": 1024, "d": true, "e": [1, 2, [32], { 'g': 'h' }], "f": null };

    parser.on('data', (data) => {
      _arr.push(data)
    });
    parser.on('finish', (data) => {
      console.log('finish', data);
      expect(data).toEqual(_data);
      expect(_arr).toEqual([
        // "a\"" 经过 JSON.stringify 后会将反斜杠转义为 \\，即 "{"b":{"a\\"":"你好，我是豆包。"}"
        // 因此这里的 uri 为 'x/y/b/a\\"'，这表示的是 JSON 字符串中的 uri，而不是 JS 对象中的 key
        { uri: 'x/y/b/a\\"', delta: '你' },
        { uri: 'x/y/b/a\\"', delta: '好' },
        { uri: 'x/y/b/a\\"', delta: '，' },
        { uri: 'x/y/b/a\\"', delta: '我' },
        { uri: 'x/y/b/a\\"', delta: '是' },
        { uri: 'x/y/b/a\\"', delta: '豆' },
        { uri: 'x/y/b/a\\"', delta: '包' },
        { uri: 'x/y/b/a\\"', delta: '。' },
        { uri: 'x/y/c', delta: 1024 },
        { uri: 'x/y/d', delta: true },
        { uri: 'x/y/e/0', delta: 1 },
        { uri: 'x/y/e/1', delta: 2 },
        { uri: 'x/y/e/2/0', delta: 32 },
        { uri: 'x/y/e/3/g', delta: 'h' },
        { uri: 'x/y/f', delta: null }
      ]);
      done();
    });

    parser.trace(JSON.stringify(_data));
  });

  test('complex JSON string one by one', done => {
    const _arr: any[] = [];
    const _data = { "b": { "a": "你好，我是豆包。" }, "c": 1024, "d": true, "e": [1, 2, [32], { 'g': 'h' }], "f": null };

    parser.on('data', (data) => {
      _arr.push(data)
    });
    parser.on('finish', (data) => {
      expect(data).toEqual(_data);
      expect(_arr).toEqual([
        { uri: 'x/y/b/a', delta: '你' },
        { uri: 'x/y/b/a', delta: '好' },
        { uri: 'x/y/b/a', delta: '，' },
        { uri: 'x/y/b/a', delta: '我' },
        { uri: 'x/y/b/a', delta: '是' },
        { uri: 'x/y/b/a', delta: '豆' },
        { uri: 'x/y/b/a', delta: '包' },
        { uri: 'x/y/b/a', delta: '。' },
        { uri: 'x/y/c', delta: 1024 },
        { uri: 'x/y/d', delta: true },
        { uri: 'x/y/e/0', delta: 1 },
        { uri: 'x/y/e/1', delta: 2 },
        { uri: 'x/y/e/2/0', delta: 32 },
        { uri: 'x/y/e/3/g', delta: 'h' },
        { uri: 'x/y/f', delta: null }
      ]);
      done();
    });

    const tokens = JSON.stringify(_data).split('');
    for (let i = 0; i < tokens.length; i++) {
      parser.trace(tokens[i]);
    }
  });

  test('invalid JSON string', done => {
    try {
      parser.trace('bearbobo');
    } catch (error: any) {
      expect(error.message).toBe('Invalid TOKEN');
      done();
    }
  });

  test('invalid JSON string', done => {
    try {
      parser.trace('true');
    } catch (error: any) {
      expect(error.message).toBe('Invalid TOKEN');
      done();
    }
  });

  test('invalid JSON string', done => {
    try {
      parser.trace('false');
    } catch (error: any) {
      expect(error.message).toBe('Invalid TOKEN');
      done();
    }
  });

  test('invalid JSON string', done => {
    try {
      parser.trace('20240908.123');
    } catch (error: any) {
      expect(error.message).toBe('Invalid TOKEN');
      done();
    }
  });

  test('invalid JSON string', done => {
    try {
      parser.trace('-20240908');
    } catch (error: any) {
      expect(error.message).toBe('Invalid TOKEN');
      done();
    }
  });

  test('invalid JSON string', done => {
    try {
      parser.trace('null');
    } catch (error: any) {
      expect(error.message).toBe('Invalid TOKEN');
      done();
    }
  });

  // 边界值分析
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

  // 错误推测
  test('Empty JSON string', done => {
    try {
      parser.trace('');
    } catch (error: any) {
      expect(error.message).toBe('Invalid TOKEN');
      done();
    }
  });

  // 在没有 autoFix 能力时，这个测试用例会抛出异常
  test('JSON string without quotation marks', done => {
    try {
      parser.trace('{name:bearbobo}');
    } catch (error: any) {
      expect(error.message).toBe('Invalid TOKEN');
      done();
    }
  });

  // JSON格式中，key需要使用双引号包裹
  test('JSON string with mismatched parentheses', done => {
    try {
      parser.trace('{"name":"bearbobo"');
    } catch (error: any) {
      expect(error.message).toBe('Invalid TOKEN');
      done();
    }
  });

  // JSON格式中，key需要使用双引号包裹，因此单引号是非法的
  test('JSON string containing illegal characters 2', done => {
    try {
      parser.trace(`{'name':"John"}`);
    } catch (error: any) {
      expect(error.message).toBe('Invalid TOKEN');
      done();
    }
  });

  // JSON格式中，反斜杠本身需要转义，需要使用两个反斜杠来表示，因此一个反斜杠是非法的
  test('JSON string containing illegal characters', done => {
    try {
      parser.trace('{"name":"Bearbobo\n"}');
    } catch (error: any) {
      expect(error.message).toBe('Invalid TOKEN');
      done();
    }
  });
})
