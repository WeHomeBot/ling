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

//判断空白符
function isWhiteSpace(str: string) {
  return /^\s+$/.test(str);
}

class JSONParser extends EventEmitter {
  private content: string[] = [];
  private stateStack: LexerStates[] = [LexerStates.Begin];
  private currentToken = '';
  private keyPath: string[] = [];
  private autoFix = false;

  constructor(options: { autoFix: boolean, parentPath: string | null } = { autoFix: false, parentPath: null }) {
    super();
    this.autoFix = options.autoFix;
    if(options.parentPath) this.keyPath.push(options.parentPath);
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
    if(state === LexerStates.Value) {
      this.keyPath.pop();
    }
    return state;
  }

  private reduceState() {
    // TODO
    const currentState = this.currentState;
    if(currentState === LexerStates.String) {
      const str = this.currentToken;
      this.popState();
      if(this.currentState === LexerStates.Key) {
        this.keyPath.push(str);
      } else if(this.currentState === LexerStates.Value) {
        // ...
        this.popState();
      }
    } else if(currentState === LexerStates.Number) {
      const num = Number(this.currentToken);
      this.popState();
      if(this.currentState === LexerStates.Value) {
        // ...
        this.emit('data', {
          uri: this.keyPath.join('/'),
          delta: num,
        });
        this.popState();
      }
    } else if(currentState === LexerStates.Boolean) {
      const str = this.currentToken;
      this.popState();
      if(this.currentState === LexerStates.Value) {
        this.emit('data', {
          uri: this.keyPath.join('/'),
          delta: isTrue(str),
        });
        this.popState();
      }
    } else if(currentState === LexerStates.Null) {
      const str = this.currentToken;
      this.popState();
      if(this.currentState === LexerStates.Value) {
        this.emit('data', {
          uri: this.keyPath.join('/'),
          delta: null,
        });
        this.popState();
      }
    } else {
      this.traceError(this.content.join(''));
    }
  }

  private traceError(input: string) {
    console.error('Invalid TOKEN', input);
    this.content.pop();
    throw new Error('Invalid TOKEN');
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
      if(this.stateStack[this.stateStack.length - 2] === LexerStates.Value) {
        this.emit('data', {
          uri: this.keyPath.join('/'),
          delta: input,
        });
      }
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
    } else if(input === '.' || input === '-' || isNumeric(input)) {
      this.currentToken += input;
      this.pushState(LexerStates.Number);
    } else if(input === 't' || input === 'f') {
      this.currentToken += input;
      this.pushState(LexerStates.Boolean);
    } else if(input === 'n') {
      this.currentToken += input;
      this.pushState(LexerStates.Null);
    }
  }

  private traceNumber(input: string) {
    if(isWhiteSpace(input)) {
      return;
    }
    if(isNumeric(this.currentToken + input)) {
      this.currentToken += input;
      return;
    }
    if(input === ',') {
      this.reduceState();
    } else if(input === '}') {
      this.reduceState();
      this.trace(input);
    }
  }

  private traceBoolean(input: string) {
    if(isWhiteSpace(input)) {
      return;
    }
    this.currentToken += input;
    if(this.currentToken === 'true' || this.currentToken === 'false') {
      this.reduceState();
    } else if('true'.startsWith(this.currentToken) || 'false'.startsWith(this.currentToken)) {
      return;
    } else {
      this.traceError(input);
    }
  }
  
  private traceNull(input: string) {
    if(isWhiteSpace(input)) {
      return;
    }
    this.currentToken += input;
    if(this.currentToken === 'null') {
      this.reduceState();
    } else if('null'.startsWith(this.currentToken)) {
      return;
    } else {
      this.traceError(input);
    }
  }

  // public finish() { // 结束解析
  //   this.stateStack.push(LexerStates.Finish);
  //   this.reduceState();
  // }

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
    else if(currentState === LexerStates.Number) {
      this.traceNumber(input);
    }
    else if(currentState === LexerStates.Boolean) {
      this.traceBoolean(input);
    }
    else if(currentState === LexerStates.Null) {
      this.traceNull(input);
    }
    else {
      this.traceError(input);
    }
  }
}

export { JSONParser };