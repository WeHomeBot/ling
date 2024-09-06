import EventEmitter from 'node:events';

const enum LexerStates {
  Begin = 'Begin',
  ObjectOpen = 'ObjectOpen',
  ObjectClose = 'ObjectClose',
  ArrayOpen = 'ArrayOpen',
  ArrayClose = 'ArrayClose',
  Key = 'Key',
  Value = 'Value',
  String = 'String',
  Number = 'Number',
  Boolean = 'Boolean',
  Null = 'Null',
  Finish = 'Finish',
}

function isNumeric(str: unknown) {
  return !isNaN(str as number) && // use type coercion to parse the _entirety_ of the string (`parseFloat` alone does not do this)...
         !isNaN(parseFloat(str as string)) // ...and ensure strings of whitespace fail
}
function isTrue(str: string) {
  return str === 'true';
}
function isFalse(str: string) {
  return str === 'false';
}
function isNull(str: string) {
  return str === 'null';
}
//判断空白符
function isWhiteSpace(str: string) {
  return /^\s+$/.test(str);
}

class JSONParser extends EventEmitter {
  private parentPath: string | null;
  private content: string[] = [];
  private stateStack: LexerStates[] = [LexerStates.Begin];
  private currentToken = '';
  private keyPath: string[] = [];

  constructor(parentPath: string | null = null) {
    super();
    this.parentPath = parentPath;
  }

  get currentState() {
    return this.stateStack[this.stateStack.length - 1];
  }

  private pushState(state: LexerStates) {
    console.log('pushState', state);
    this.stateStack.push(state);
  }

  private popState() {
    this.currentToken = '';
    const state = this.stateStack.pop();
    console.log('popState', state, this.currentState);
    return state;
  }

  private reduceState() {
    // TODO
    const currentState = this.currentState;
    if(currentState === LexerStates.String) {
      const str = this.currentToken;
      this.popState();
      if(this.currentState === LexerStates.Key) {
        // this.emit('key', str);
        this.keyPath.push(str);
      } else if(this.currentState === LexerStates.Value) {
        // ...
        this.popState();
      }
    }
  }

  private traceError(input: string) {
    console.error('Invalid TOKEN', input);
    this.content.pop();
  }

  private traceBegin(input: string) {
    // TODO： 目前只简单处理了对象和数组的情况，对于其他类型的合法JSON处理需要补充
    if(input === '{') {
      this.pushState(LexerStates.ObjectOpen);
    } else if(input === '[') {
      this.pushState(LexerStates.ArrayOpen);
    } else {
      this.traceError(input);
      return; // recover
    }
  }

  private traceObjectOpen(input: string) {
    if(isWhiteSpace(input)) {
      return;
    }
    if(input === '"') {
      this.pushState(LexerStates.Key);
      this.pushState(LexerStates.String);
    } else if(input === '}') {
      this.popState();
      if(this.currentState === LexerStates.Begin) {
        this.popState();
        this.pushState(LexerStates.Finish);
        this.emit('finish', this.content.join(''));
      } else if(this.currentState === LexerStates.Value) {
        this.popState();
      }
    }
  }

  private traceString(input: string) {
    if(input === '\n') {
      this.traceError(input);
      return;
    }
    if(input === '"' && (this.currentToken[this.currentToken.length - 1] !== '\\' || this.currentToken[this.currentToken.length - 2] === '\\')) {
      this.reduceState();
    } else {
      this.currentToken += input;
      this.emit('data', {
        uri: this.keyPath.join('/'),
        delta: input,
      });
    }
  }

  private traceKey(input: string) {
    if(isWhiteSpace(input)) {
      return;
    }
    if(input === ':') {
      this.popState();
      this.pushState(LexerStates.Value);
    }
  }

  private traceValue(input: string) {
    if(isWhiteSpace(input)) {
      return;
    }
    if(input === '"') {
      this.pushState(LexerStates.String);
    } else if(input === '{') {
      this.pushState(LexerStates.ObjectOpen);
    }
  }

  public finish() { // 结束解析
    this.stateStack.push(LexerStates.Finish);
    this.reduceState();
  }

  public trace(input: string) {
    console.log('trace', input);
    const currentState = this.currentState;

    if(input.length > 1) {
      [...input].forEach((char) => {
        this.trace(char);
      });
      return;
    }

    this.content.push(input);
    if(currentState === LexerStates.Begin) {
      this.traceBegin(input);
    }
    else if(currentState === LexerStates.ObjectOpen) {
      this.traceObjectOpen(input);
    }
    else if(currentState === LexerStates.String) {
      this.traceString(input);
    }
    else if(currentState === LexerStates.Key) {
      this.traceKey(input);
    }
    else if(currentState === LexerStates.Value) {
      this.traceValue(input);
    }
  }
}

export { JSONParser };