import EventEmitter from 'node:events';

const enum LexerStates {
  Begin = 'Begin',
  Object = 'Object',
  Array = 'Array',
  Key = 'Key',
  Value = 'Value',
  String = 'String',
  Number = 'Number',
  Boolean = 'Boolean',
  Null = 'Null',
  Finish = 'Finish',
  Breaker = 'Breaker',
}

function isNumeric(str: unknown) {
  return !isNaN(str as number) && // use type coercion to parse the _entirety_ of the string (`parseFloat` alone does not do this)...
    !isNaN(parseFloat(str as string)) // ...and ensure strings of whitespace fail
}

function isTrue(str: string) {
  return str === 'true';
}

//判断空白符
function isWhiteSpace(str: string) {
  return /^\s+$/.test(str);
}

export class JSONParser extends EventEmitter {
  private content: string[] = [];
  private stateStack: LexerStates[] = [LexerStates.Begin];
  private currentToken = '';
  private keyPath: string[] = [];
  private arrayIndexStack: any[] = [];
  private autoFix = false;
  private debug = false;

  constructor(options: { autoFix?: boolean, parentPath?: string | null, debug?: boolean } = { autoFix: false, parentPath: null, debug: false }) {
    super();
    this.autoFix = !!options.autoFix;
    this.debug = !!options.debug;
    if (options.parentPath) this.keyPath.push(options.parentPath);
  }

  get currentState() {
    return this.stateStack[this.stateStack.length - 1];
  }

  get arrayIndex() {
    return this.arrayIndexStack[this.arrayIndexStack.length - 1];
  }

  private log(...args: any[]) {
    if (this.debug) {
      console.log(...args, this.content.join(''));
    }
  }

  private pushState(state: LexerStates) {
    this.log('pushState', state);
    this.stateStack.push(state);
    if (state === LexerStates.Array) {
      this.arrayIndexStack.push({ index: 0 });
    }
  }

  private popState() {
    this.currentToken = '';
    const state = this.stateStack.pop();
    this.log('popState', state, this.currentState);
    if (state === LexerStates.Value) {
      this.keyPath.pop();
    }
    if (state === LexerStates.Array) {
      this.arrayIndexStack.pop();
    }
    return state;
  }

  private reduceState() {
    const currentState = this.currentState;
    if (currentState === LexerStates.String) {
      const str = this.currentToken;
      this.popState();
      if (this.currentState === LexerStates.Key) {
        this.keyPath.push(str);
      } else if (this.currentState === LexerStates.Value) {
        this.emit('string-resolve', {
          uri: this.keyPath.join('/'),
          delta: str,
        });
        this.popState();
      }
    } else if (currentState === LexerStates.Number) {
      const num = Number(this.currentToken);
      this.popState();
      if (this.currentState === LexerStates.Value) {
        // ...
        this.emit('data', {
          uri: this.keyPath.join('/'), // JSONURI https://github.com/aligay/jsonuri
          delta: num,
        });
        this.popState();
      }
    } else if (currentState === LexerStates.Boolean) {
      const str = this.currentToken;
      this.popState();
      if (this.currentState === LexerStates.Value) {
        this.emit('data', {
          uri: this.keyPath.join('/'),
          delta: isTrue(str),
        });
        this.popState();
      }
    } else if (currentState === LexerStates.Null) {
      this.popState();
      if (this.currentState === LexerStates.Value) {
        this.emit('data', {
          uri: this.keyPath.join('/'),
          delta: null,
        });
        this.popState();
      }
    } else if (currentState === LexerStates.Array || currentState === LexerStates.Object) {
      this.popState();
      if (this.currentState === LexerStates.Begin) {
        this.popState();
        this.pushState(LexerStates.Finish);
        this.emit('finish', JSON.parse(this.content.join('')));
      } else if (this.currentState === LexerStates.Value) {
        this.popState();
        this.pushState(LexerStates.Breaker);
      }
    }
    else {
      this.traceError(this.content.join(''));
    }
  }

  private traceError(input: string) {
    // console.error('Invalid Token', input);
    this.content.pop();
    throw new Error('Invalid Token');
  }

  private traceBegin(input: string) {
    // TODO： 目前只简单处理了对象和数组的情况，对于其他类型的合法JSON处理需要补充
    if (input === '{') {
      this.pushState(LexerStates.Object);
    } else if (input === '[') {
      this.pushState(LexerStates.Array);
    } else {
      this.traceError(input);
      return; // recover
    }
  }

  private traceObject(input: string) {
    if (isWhiteSpace(input) || input === ',') {
      return;
    }
    if (input === '"') {
      this.pushState(LexerStates.Key);
      this.pushState(LexerStates.String);
    } else if (input === '}') {
      this.reduceState();
    } else {
      this.traceError(input);
    }
  }

  private traceArray(input: string) {
    if (isWhiteSpace(input)) {
      return;
    }
    if (input === '"') {
      this.keyPath.push((this.arrayIndex.index++).toString());
      this.pushState(LexerStates.Value);
      this.pushState(LexerStates.String);
    }
    else if (input === '.' || input === '-' || isNumeric(input)) {
      this.keyPath.push((this.arrayIndex.index++).toString());
      this.currentToken += input;
      this.pushState(LexerStates.Value);
      this.pushState(LexerStates.Number);
    }
    else if (input === 't' || input === 'f') {
      this.keyPath.push((this.arrayIndex.index++).toString());
      this.currentToken += input;
      this.pushState(LexerStates.Value);
      this.pushState(LexerStates.Boolean);
    }
    else if (input === 'n') {
      this.keyPath.push((this.arrayIndex.index++).toString());
      this.currentToken += input;
      this.pushState(LexerStates.Value);
      this.pushState(LexerStates.Null);
    }
    else if (input === '{') {
      this.keyPath.push((this.arrayIndex.index++).toString());
      this.pushState(LexerStates.Value);
      this.pushState(LexerStates.Object);
    }
    else if (input === '[') {
      this.keyPath.push((this.arrayIndex.index++).toString());
      this.pushState(LexerStates.Value);
      this.pushState(LexerStates.Array);
    }
    else if (input === ']') {
      this.reduceState();
    }
  }

  private traceString(input: string) {
    if (input === '\n') {
      this.traceError(input);
    }
    const currentToken = this.currentToken.replace(/\\\\/g, '');  // 去掉转义的反斜杠
    if (input === '"' && currentToken[this.currentToken.length - 1] !== '\\') {
      this.reduceState();
      if (this.stateStack[this.stateStack.length - 2] === LexerStates.Value) {
        this.pushState(LexerStates.Breaker);
      }
    } else {
      this.currentToken += input;
      if (this.stateStack[this.stateStack.length - 2] === LexerStates.Value) {
        this.emit('data', {
          uri: this.keyPath.join('/'),
          delta: input,
        });
      }
    }
  }

  private traceKey(input: string) {
    if (isWhiteSpace(input)) {
      return;
    }
    if (input === ':') {
      this.popState();
      this.pushState(LexerStates.Value);
    }
  }

  private traceValue(input: string) {
    if (isWhiteSpace(input)) {
      return;
    }
    if (input === '"') {
      this.pushState(LexerStates.String);
    } else if (input === '{') {
      this.pushState(LexerStates.Object);
    } else if (input === '.' || input === '-' || isNumeric(input)) {
      this.currentToken += input;
      this.pushState(LexerStates.Number);
    } else if (input === 't' || input === 'f') {
      this.currentToken += input;
      this.pushState(LexerStates.Boolean);
    } else if (input === 'n') {
      this.currentToken += input;
      this.pushState(LexerStates.Null);
    } else if (input === '[') {
      this.pushState(LexerStates.Array);
    }
  }

  private traceNumber(input: string) {
    if (isWhiteSpace(input)) {
      return;
    }
    if (isNumeric(this.currentToken + input)) {
      this.currentToken += input;
      return;
    }
    if (input === ',') {
      this.reduceState();
    } else if (input === '}' || input === ']') {
      this.reduceState();
      this.content.pop();
      this.trace(input);
    }
  }

  private traceBoolean(input: string) {
    if (isWhiteSpace(input)) {
      return;
    }

    if (input === ',') {
      this.reduceState();
      return;
    }

    if (input === '}' || input === ']') {
      this.reduceState();
      this.content.pop();
      this.trace(input);
      return;
    }

    this.currentToken += input;
    if ('true'.startsWith(this.currentToken) || 'false'.startsWith(this.currentToken)) {
      return;
    }

    this.traceError(input);
  }

  private traceNull(input: string) {
    if (isWhiteSpace(input)) {
      return;
    }
    this.currentToken += input;
    if (input === ',') {
      this.reduceState();
    } else if (input === '}' || input === ']') {
      this.reduceState();
      this.content.pop();
      this.trace(input);
    } else if ('null'.startsWith(this.currentToken)) {
      return;
    } else {
      this.traceError(input);
    }
  }

  private traceBreaker(input: string) {
    if (isWhiteSpace(input)) {
      return;
    }
    if (input === ',') {
      this.popState();
    }
    else if (input === '}' || input === ']') {
      this.popState();
      this.content.pop();
      this.trace(input);
    }
  }

  // public finish() { // 结束解析
  //   this.stateStack.push(LexerStates.Finish);
  //   this.reduceState();
  // }

  public trace(input: string) {
    const currentState = this.currentState;
    this.log('trace', input, currentState);

    if (input.length > 1) {
      [...input].forEach((char) => {
        this.trace(char);
      });
      return;
    }

    this.content.push(input);
    if (currentState === LexerStates.Begin) {
      this.traceBegin(input);
    }
    else if (currentState === LexerStates.Object) {
      this.traceObject(input);
    }
    else if (currentState === LexerStates.String) {
      this.traceString(input);
    }
    else if (currentState === LexerStates.Key) {
      this.traceKey(input);
    }
    else if (currentState === LexerStates.Value) {
      this.traceValue(input);
    }
    else if (currentState === LexerStates.Number) {
      this.traceNumber(input);
    }
    else if (currentState === LexerStates.Boolean) {
      this.traceBoolean(input);
    }
    else if (currentState === LexerStates.Null) {
      this.traceNull(input);
    }
    else if (currentState === LexerStates.Array) {
      this.traceArray(input);
    }
    else if (currentState === LexerStates.Breaker) {
      this.traceBreaker(input);
    }
    else if (!isWhiteSpace(input)) {
      this.traceError(input);
    }
  }
}
