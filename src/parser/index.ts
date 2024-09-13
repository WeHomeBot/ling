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

function isQuotationMark(str: string) {
  return str === '"' || str === '“' || str === '”' || str === '‘' || str === '’' || str === "'";
}

export class JSONParser extends EventEmitter {
  private content: string[] = [];
  private stateStack: LexerStates[] = [LexerStates.Begin];
  private currentToken = '';
  private keyPath: string[] = [];
  private arrayIndexStack: any[] = [];
  private autoFix = false;
  private debug = false;
  private lastPopStateToken: { state: LexerStates, token: string } | null = null;

  constructor(options: { autoFix?: boolean, parentPath?: string | null, debug?: boolean } = { autoFix: false, parentPath: null, debug: false }) {
    super();
    this.autoFix = !!options.autoFix;
    this.debug = !!options.debug;
    if (options.parentPath) this.keyPath.push(options.parentPath);
  }

  get currentState() {
    return this.stateStack[this.stateStack.length - 1];
  }

  get lastState() {
    return this.stateStack[this.stateStack.length - 2];
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
    this.lastPopStateToken = { state: this.currentState, token: this.currentToken };
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
    if (currentState === LexerStates.Breaker) {
      this.popState();
      if(this.currentState === LexerStates.Value) {
        this.popState();
      }
    } else if (currentState === LexerStates.String) {
      const str = this.currentToken;
      this.popState();
      if (this.currentState === LexerStates.Key) {
        this.keyPath.push(str);
      } else if (this.currentState === LexerStates.Value) {
        this.emit('string-resolve', {
          uri: this.keyPath.join('/'),
          delta: str,
        });
        // this.popState();
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
        // console.log('finish', this.content.join(''));
        this.emit('finish', JSON.parse(this.content.join('')));
      } else if (this.currentState === LexerStates.Value) {
        // this.popState();
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
    if(this.autoFix) {
      if (this.currentState === LexerStates.Begin || this.currentState === LexerStates.Finish) {
        return;
      }
      if (this.currentState === LexerStates.Breaker) {
        if(this.lastPopStateToken?.state === LexerStates.String) {
          // 修复 token 引号转义
          const lastPopStateToken = this.lastPopStateToken.token;
          this.stateStack[this.stateStack.length - 1] = LexerStates.String;
          this.currentToken = lastPopStateToken || '';
          let traceToken = '';
          for(let i = this.content.length - 1; i >= 0; i--) {
            if(this.content[i].trim()) {
              this.content.pop();
              traceToken = '\\\"' + traceToken;
              break;
            }
            traceToken = this.content.pop() + traceToken;
          }
          this.trace(traceToken + input);
          return;
        }
      }
      if(this.currentState === LexerStates.String) {
        // 回车的转义
        if(input === '\n') {
          if(this.lastState === LexerStates.Value) {
            const currentToken = this.currentToken.trimEnd();
            if(currentToken.endsWith(',') || currentToken.endsWith(']') || currentToken.endsWith('}')) {
              // 这种情况下是丢失了最后一个引号
              for(let i = this.content.length - 1; i >= 0; i--) {
                if(this.content[i].trim()) {
                  break;
                }
                this.content.pop();
              }
              const token = this.content.pop() as string;
              // console.log('retrace -> ', '"' + token + input);
              this.trace('"' + token + input);
              // 这种情况下多发送(emit)出去了一个特殊字符，前端需要修复，发送一个消息让前端能够修复
              this.emit('data', {
                uri: this.keyPath.join('/'),
                delta: '',
                error: {
                  token,
                },
              });
            } else {
              // this.currentToken += '\\n';
              // this.content.push('\\n');
              this.trace('\\n');
            }
          }
          return;
        }
      }
      if(this.currentState === LexerStates.Key) {
        if(input !== '"') {
          // 处理多余的左引号 eg. {""name": "bearbobo"}
          if(this.lastPopStateToken?.token === '') {
            this.content.pop();
            this.content.push(input);
            this.pushState(LexerStates.String);
          }
        }
        // key 的引号后面还有多余内容，忽略掉
        return;
      }

      if(this.currentState === LexerStates.Value) {
        if (input === ',' || input === '}' || input === ']') {
          // value 丢失了
          this.pushState(LexerStates.Null);
          this.currentToken = '';
          this.content.push('null');
          this.reduceState();
          if(input !== ',') {
            this.trace(input);
          } else {
            this.content.push(input);
          }
        } else {
          // 字符串少了左引号
          this.pushState(LexerStates.String);
          this.currentToken = '';
          this.content.push('"');
          // 不处理 Value 的引号情况，因为前端修复更简单
          // if(!isQuotationMark(input)) {
             this.trace(input);
          // }
        }
        return;
      }

      if(this.currentState === LexerStates.Object) {
        // 直接缺少了 key
        if(input === ':') {
          this.pushState(LexerStates.Key);
          this.pushState(LexerStates.String);
          this.currentToken = '';
          this.content.push('"');
          this.trace(input);
          return;
        }
        // 一般是key少了左引号
        this.pushState(LexerStates.Key);
        this.pushState(LexerStates.String);
        this.currentToken = '';
        this.content.push('"');
        if(!isQuotationMark(input)) {
          // 单引号和中文引号
          this.trace(input);
        }
        return;
      }

      if(this.currentState === LexerStates.Number || this.currentState === LexerStates.Boolean || this.currentState === LexerStates.Null) {
        // number, boolean 和 null 失败
        const currentToken = this.currentToken;
        this.stateStack.pop();
        this.currentToken = '';
        // this.currentToken = '';
        for(let i = 0; i < [...currentToken].length; i++) {
          this.content.pop();
        }
        // console.log('retrace', '"' + this.currentToken + input);
        
        this.trace('"' + currentToken + input);
        return;
      }
    }
    // console.log('Invalid Token', input, this.currentToken, this.currentState, this.lastState, this.lastPopStateToken);
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
    // this.currentToken = '';
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
      return;
    }
    const currentToken = this.currentToken.replace(/\\\\/g, '');  // 去掉转义的反斜杠
    if (input === '"' && currentToken[this.currentToken.length - 1] !== '\\') {
      // 字符串结束符
      const lastState = this.lastState;
      this.reduceState();
      if (lastState === LexerStates.Value) {
        this.pushState(LexerStates.Breaker);
      }
    } else if(this.autoFix && input === ':' && this.lastState === LexerStates.Key) {
      // 默认这种情况下少了右引号，补一个
      this.content.pop();
      for(let i = this.content.length - 1; i >= 0; i--) {
        if(this.content[i].trim()) {
          break;
        }
        this.content.pop();
      }
      this.trace('":');
    } else if(this.autoFix && isQuotationMark(input) && this.lastState === LexerStates.Key) {
      // 处理 key 中的中文引号和单引号
      this.content.pop();
      return;
    } else {
      this.currentToken += input;
      if (this.lastState === LexerStates.Value) {
        this.emit('data', {
          uri: this.keyPath.join('/'),
          delta: input,
        });
      }
    }
  }

  private traceKey(input: string) {
    if (isWhiteSpace(input)) {
      this.content.pop();
      return;
    }
    if (input === ':') {
      this.popState();
      this.pushState(LexerStates.Value);
    } else {
      this.traceError(input);
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
    } else {
      this.traceError(input);
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
    } else {
      this.traceError(input);
    }
  }

  private traceBoolean(input: string) {
    if (isWhiteSpace(input)) {
      return;
    }

    if (input === ',') {
      if(this.currentToken === 'true' || this.currentToken === 'false') {
        this.reduceState();
      } else {
        this.traceError(input);
      }
      return;
    }

    if (input === '}' || input === ']') {
      if(this.currentToken === 'true' || this.currentToken === 'false') {
        this.reduceState();
        this.content.pop();
        this.trace(input);
      } else {
        this.traceError(input);
      }
      return;
    }

    if ('true'.startsWith(this.currentToken + input) || 'false'.startsWith(this.currentToken + input)) {
      this.currentToken += input;
      return;
    }

    this.traceError(input);
  }

  private traceNull(input: string) {
    if (isWhiteSpace(input)) {
      return;
    }

    if (input === ',') {
      if(this.currentToken === 'null') {
        this.reduceState();
      } else {
        this.traceError(input);
      }
      return;
    }

    if (input === '}' || input === ']') {
      this.reduceState();
      this.content.pop();
      this.trace(input);
      return;
    }
  
    if ('null'.startsWith(this.currentToken + input)) {
      this.currentToken += input;
      return;
    }

    this.traceError(input);
  }

  private traceBreaker(input: string) {
    if (isWhiteSpace(input)) {
      return;
    }
    if (input === ',') {
      this.reduceState();
    }
    else if (input === '}' || input === ']') {
      this.reduceState();
      this.content.pop();
      this.trace(input);
    } else {
      this.traceError(input);
    }
  }

  // public finish() { // 结束解析
  //   this.stateStack.push(LexerStates.Finish);
  //   this.reduceState();
  // }

  public trace(input: string) {
    const currentState = this.currentState;
    this.log('trace', JSON.stringify(input), currentState, JSON.stringify(this.currentToken));

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
