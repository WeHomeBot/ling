import { Writable } from 'stream';

/**
 * A fast HTML parser for NodeJS using Writable streams.
 *
 * What this is:
 * Simple and fast HTML parser purley written for NodeJS. No extra production dependencies.
 * A handy way parse ATOM/RSS/RDF feeds and such. No validation is made on the document that is parsed.
 *
 * Motivation
 * There is already quite a few parsers out there. I just wanted a parser that was as tiny and fast as possible to handle easy parsing of
 * RSS/ATOM/RDF feeds using streams, no fancy stuff needed. If you want more functionality you should check out other recommended parsers (see below)
 *
 * Usage
 * Just #pipe() a <stream.Readable> and you are ready to listen for events.
 * You can also use the #write() method to write directly to the parser.
 *
 * The source is written using ES2015, babel is used to translate to the dist.
 *
 * Other recommended parsers for node that are great:
 * https://github.com/isaacs/sax-js
 * https://github.com/xmppjs/ltx
 *
 * Events:
 * - text
 * - instruction
 * - opentag
 * - closetag
 * - cdata
 *
 * Comments are ignored, so there is no events for them.
 *
 */

// 定义解析器状态的枚举
enum STATE {
	TEXT = 0,
	TAG_NAME = 1,
	INSTRUCTION = 2,
	IGNORE_COMMENT = 4,
	CDATA = 8,
	DOCTYPE = 16,
	INIT = 32,
	END = 64
}

// 定义标签类型的枚举
enum TAG_TYPE {
	NONE = 0,
	OPENING = 1,
	CLOSING = 2,
	SELF_CLOSING = 3
}

// 定义事件类型
export const EVENTS = {
	TEXT: 'text',
  TEXT_DELTA: 'text_delta',
	INSTRUCTION: 'instruction',
	OPEN_TAG: 'opentag',
	CLOSE_TAG: 'closetag',
	CDATA: 'cdata',
	DOCTYPE: 'doctype'
} as const;

// 定义事件类型的类型
export type EventType = keyof typeof EVENTS;

// 定义属性对象的接口
interface Attributes {
	[key: string]: string;
}

// 定义解析标签字符串的返回类型
interface ParsedTag {
	name: string;
	attributes: Attributes;
}

function isSelfClosingTag(name: string): boolean {
  // HTML自闭合标签列表
  const selfClosingTags = [
    'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
    'link', 'meta', 'param', 'source', 'track', 'wbr', '!doctype'
  ];
  
  // 将标签名转换为小写并检查是否在自闭合标签列表中
  return selfClosingTags.includes(name.toLowerCase());
}

export class HTMLParser extends Writable {
	private stateStack: STATE[] = [STATE.INIT];
	private buffer: string = '';
	private pos: number = 0;
	private tagType: TAG_TYPE = TAG_TYPE.NONE;
	private pathStack: string[] = []; // 用于跟踪XML路径的栈
	private pathStackCount: Record<string, number> = {}; // 路径栈的长度

	constructor(options?: {parentPath?: string | null}) {
		super();
		this.init();
	}

	get state(): STATE | undefined {
		return this.stateStack[this.stateStack.length - 1];
	}

	pushStack(path: string) {
		const parent = this._getXPath();
		this.pathStackCount[parent] = 1 + (this.pathStackCount[parent] || 0);
		this.pathStack.push(`${path}[${this.pathStackCount[parent]}]`);
	}

	popStack() {
		this.pathStack.pop();
	}

	trace(input: string) {
		this.write(input);
	}

	init() {
		this.stateStack = [STATE.INIT];
		this.buffer = '';
		this.pos = 0;
		this.tagType = TAG_TYPE.NONE;
		this.pathStack = ['$$root']; // 初始化路径栈
		this.removeAllListeners();
	}

	end(args?: any) {
		if(this.state !== STATE.END) {
			this.emit('end'); // 触发end事件
			this.stateStack.push(STATE.END);
		}
		return super.end(args);
	}

	_write(chunk: any, encoding: BufferEncoding, done: (error?: Error | null) => void): void {
		const chunkStr = typeof chunk !== 'string' ? chunk.toString() : chunk;
		for (let i = 0; i < chunkStr.length; i++) {
			if(this.state === STATE.END) break;
			const c = chunkStr[i];
			if(this.state === STATE.INIT && c !== '<') {
				continue;
			}
			const prev = this.buffer[this.pos - 1];
			this.buffer += c;
			this.pos++;

			switch (this.state) {
				case STATE.INIT:
					// 这样能过滤掉AI前面输出的没用文本
					if (c === '<') this._onStartNewTag();
					break;
				case STATE.TEXT:
					if (c === '<') this._onStartNewTag();
          else {
						const xpath = this._getXPath();
						// 如果是script或者style标签，则不发送TEXT_DELTA事件，否则可能会导致网页编译报错
						if(xpath.endsWith('script') || xpath.endsWith('style')) break;
						// 从第一个非空的字符开始
						if(c.trim()) {
							let begining = false;
							if(!this.pathStack[this.pathStack.length - 1].startsWith('$$TEXTNODE')) {
								this.pushStack('$$TEXTNODE');
								begining = true;
							}
            	if(begining || prev.trim()) {
								this.emit(EVENTS.TEXT_DELTA, this._getXPath(), c);
							} else {
								this.emit(EVENTS.TEXT_DELTA, this._getXPath(), ` ${c}`);
							}
						}
          }
					break;

				case STATE.TAG_NAME:
					if (prev === '<' && c === '?') { this._onStartInstruction() };
					if (prev === '<' && c === '/') { this._onCloseTagStart() };
					if (this.buffer[this.pos - 3] === '<' && prev === '!' && c === '[') { this._onCDATAStart() };
					if (this.buffer[this.pos - 3] === '<' && prev === '!' && c === '-') { this._onCommentStart() };
					// 检测DOCTYPE
					if (this.buffer[this.pos - 3] === '<' && prev === '!' && (c === 'D' || c === 'd')) { this._onDOCTYPEStart() };
					if (c === '>') {
						if (prev === "/") { this.tagType |= TAG_TYPE.CLOSING; }
						this._onTagCompleted();
					}
					break;

				case STATE.INSTRUCTION:
					if (prev === '?' && c === '>') this._onEndInstruction();
					break;

				case STATE.CDATA:
					if (prev === ']' && c === ']') this._onCDATAEnd();
					break;

				case STATE.IGNORE_COMMENT:
					if (this.buffer[this.pos - 3] === '-' && prev === '-' && c === '>') this._onCommentEnd();
					break;
					
				case STATE.DOCTYPE:
					if (c === '>') this._onDOCTYPEEnd();
					break;
			}
		}
		done();
	}

	private _endRecording(): string {
		let rec = this.buffer.slice(1, this.pos - 1).trim();
		this.buffer = this.buffer.slice(-1); // Keep last item in buffer for prev comparison in main loop.
		this.pos = 1;
		rec = rec.charAt(rec.length - 1) === '/' ? rec.slice(0, -1) : rec;
		rec = rec.charAt(rec.length - 1) === '>' ? rec.slice(0, -2) : rec;
		return rec;
	}

	private _onStartNewTag(): void {
		const text = this._endRecording().trim();
		if (text) {
			if(!this.pathStack[this.pathStack.length - 1].startsWith('$$TEXTNODE')) {
				this.pushStack('$$TEXTNODE');
			}
			this.emit(EVENTS.TEXT, this._getXPath(), text);
			this.popStack();
		}
		if(this.state === STATE.TEXT) {
			this.stateStack.pop();
		}
		this.stateStack.push(STATE.TAG_NAME);
		this.tagType = TAG_TYPE.OPENING;
	}

	private _onTagCompleted(): void {
		const tag = this._endRecording();
		const { name, attributes } = this._parseTagString(tag);

		if ((this.tagType & TAG_TYPE.OPENING) === TAG_TYPE.OPENING) {
			this.pushStack(name)
			// 对于开标签，先发出事件，然后将标签名添加到路径栈中
			this.emit(EVENTS.OPEN_TAG, this._getXPath(), name, attributes);
		}
    if(isSelfClosingTag(name)) {
      this.tagType |= TAG_TYPE.CLOSING;
    }
		if ((this.tagType & TAG_TYPE.CLOSING) === TAG_TYPE.CLOSING) {
			// 对于闭标签，先发出事件，然后从路径栈中移除最后一个元素
			this.emit(EVENTS.CLOSE_TAG, this._getXPath(), name, attributes);
			this.popStack();
			this.stateStack.pop();
		}
		if (this.state === STATE.INIT && (this.tagType & TAG_TYPE.CLOSING) === TAG_TYPE.CLOSING) {
			this.end();
		} else {
			this.stateStack.push(STATE.TEXT);
		}
		// this.stateStack.push(STATE.TEXT);
		this.tagType = TAG_TYPE.NONE;
	}

	private _onCloseTagStart(): void {
		this._endRecording();
		this.tagType = TAG_TYPE.CLOSING;
	}

	private _onStartInstruction(): void {
		this._endRecording();
		if(this.state === STATE.TEXT) {
			this.stateStack.pop();
		}
		this.stateStack.push(STATE.INSTRUCTION);
	}

	private _onEndInstruction(): void {
		this.pos -= 1; // Move position back 1 step since instruction ends with '?>'
		const inst = this._endRecording();
		const { name, attributes } = this._parseTagString(inst);
		this.emit(EVENTS.INSTRUCTION, name, attributes);
		this.stateStack.pop();
		this.stateStack.push(STATE.TEXT);
	}

	private _onCDATAStart(): void {
		this._endRecording();
		if(this.state === STATE.TEXT) {
			this.stateStack.pop();
		}
		this.stateStack.push(STATE.CDATA);
	}

	private _onCDATAEnd(): void {
		let text = this._endRecording(); // Will return CDATA[XXX] we regexp out the actual text in the CDATA.
		text = text.slice(text.indexOf('[') + 1, text.lastIndexOf(']'));
		this.stateStack.pop();
		this.stateStack.push(STATE.TEXT);

		this.emit(EVENTS.CDATA, this._getXPath(), text);
	}

	private _onCommentStart(): void {
		if(this.state === STATE.TEXT) {
			this.stateStack.pop();
		}
		this.stateStack.push(STATE.IGNORE_COMMENT);
	}

	private _onCommentEnd(): void {
		this._endRecording();
		this.stateStack.pop();
		this.stateStack.push(STATE.TEXT);
	}

	private _onDOCTYPEStart(): void {
		this._endRecording();
		if(this.state === STATE.TEXT) {
			this.stateStack.pop();
		}
		this.stateStack.push(STATE.DOCTYPE);
	}

	private _onDOCTYPEEnd(): void {
		const doctype = this._endRecording();
    if (doctype.toUpperCase().startsWith('OCTYPE')) {
		  this.emit(EVENTS.DOCTYPE, doctype.slice(6).trim());
    }
		this.stateStack.pop();
		this.stateStack.push(STATE.TEXT);
	}

	/**
	 * Helper to parse a tag string 'xml version="2.0" encoding="utf-8"' with regexp.
	 * @param  {string} str the tag string.
	 * @return {ParsedTag} Object containing name and attributes
	 */
	private _parseTagString(str: string): ParsedTag {
		const [name, ...attrs] = str.split(/\s+(?=[\w:-]+=)/g);
		const attributes: Attributes = {};
		attrs.forEach((attribute) => {
			const [attrName, attrValue] = attribute.split("=");
			if (attrName && attrValue) {
				attributes[attrName] = attrValue.trim().replace(/"|'/g, "");
			}
		});
		return { name, attributes };
	}

	/**
	 * 获取当前XML路径
	 * @return {string} 当前XML路径，格式为/root/child
	 */
	private _getXPath(): string {
		return this.pathStack.join('/').slice(6); // 排除$$root
	}
}