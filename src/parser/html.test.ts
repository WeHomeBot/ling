import { HTMLParser, EVENTS } from './html.parser';

describe('HTMLParser', () => {
  let parser: HTMLParser;

  beforeEach(() => {
    parser = new HTMLParser();
  });

  test('simple HTML tag', done => {
    const openTags: any[] = [];
    const closeTags: any[] = [];
    const textContents: any[] = [];
    
    parser.init();
    parser.on(EVENTS.OPEN_TAG, (xpath, name, attributes) => {
      openTags.push({ xpath, name, attributes });
    });
    
    parser.on(EVENTS.CLOSE_TAG, (xpath, name, attributes) => {
      closeTags.push({ xpath, name, attributes });
    });
    
    parser.on(EVENTS.TEXT, (xpath, text) => {
      textContents.push({ xpath, text });
    });
    
    parser.on('end', () => {
      expect(openTags.length).toBe(1);
      expect(openTags[0].name).toBe('div');
      expect(closeTags.length).toBe(1);
      expect(closeTags[0].name).toBe('div');
      expect(textContents.length).toBe(1);
      expect(textContents[0].text).toBe('Hello World');
      done();
    });
    
    parser.write('```html\n<div>Hello World</div>\n```');
    parser.end();
  });

  test('nested HTML tags', done => {
    const openTags: any[] = [];
    const closeTags: any[] = [];

    parser.init();
    parser.on(EVENTS.OPEN_TAG, (xpath, name, attributes) => {
      openTags.push({ xpath, name });
    });
    
    parser.on(EVENTS.CLOSE_TAG, (xpath, name, attributes) => {
      closeTags.push({ xpath, name });
    });
    
    parser.on('end', () => {
      expect(openTags.length).toBe(3);
      expect(openTags[0].name).toBe('div');
      expect(openTags[1].name).toBe('p');
      expect(openTags[2].name).toBe('span');
      expect(closeTags.length).toBe(3);
      expect(closeTags[0].name).toBe('span');
      expect(closeTags[1].name).toBe('p');
      expect(closeTags[2].name).toBe('div');
      done();
    });
    
    parser.write('<div><p><span>Nested content</span></p></div>');
    parser.end();
  });

  test('HTML with attributes', done => {
    const openTags: any[] = [];

    parser.init();
    parser.on(EVENTS.OPEN_TAG, (xpath, name, attributes) => {
      openTags.push({ xpath, name, attributes });
    });
    
    parser.on('end', () => {
      expect(openTags.length).toBe(1);
      expect(openTags[0].name).toBe('div');
      expect(openTags[0].attributes.id).toBe('test');
      expect(openTags[0].attributes.class).toBe('container');
      expect(openTags[0].attributes['data-value']).toBe('123');
      done();
    });
    
    parser.write('<div id="test" class="container" data-value="123">Content</div>');
    parser.end();
  });

  test('self-closing tags', done => {
    const openTags: any[] = [];
    const closeTags: any[] = [];

    parser.init();
    parser.on(EVENTS.OPEN_TAG, (xpath, name, attributes) => {
      openTags.push({ xpath, name, attributes });
    });
    
    parser.on(EVENTS.CLOSE_TAG, (xpath, name, attributes) => {
      closeTags.push({ xpath, name, attributes });
    });
    
    parser.on('end', () => {
      expect(openTags.length).toBe(3);
      expect(closeTags.length).toBe(3);
      expect(openTags[0].name).toBe('div');
      expect(openTags[1].name).toBe('img');
      expect(openTags[2].name).toBe('br');
      expect(closeTags[0].name).toBe('img');
      expect(closeTags[1].name).toBe('br');
      expect(closeTags[2].name).toBe('div');
      done();
    });
    
    parser.write('<div><img src="test.jpg"/><br></div>');
    parser.end();
  });

  test('HTML with text delta events', done => {
    const textDeltas: any[] = [];

    parser.init();
    parser.on(EVENTS.TEXT_DELTA, (xpath, char) => {
      textDeltas.push({ xpath, char });
    });
    
    parser.on('end', () => {
      expect(textDeltas.length).toBe(10); // 'Hello World' has 10 non space characters
      expect(textDeltas.map(d => d.char).join('')).toBe('HelloWorld');
      expect(textDeltas[0].xpath).toBe('/div[1]/$$TEXTNODE[1]');
      expect(textDeltas[8].xpath).toBe('/div[1]/$$TEXTNODE[3]');
      done();
    });
    
    parser.write('<div>Hello<br> World</div>');
    parser.end();
  });

  test('HTML with CDATA section', done => {
    const cdataContents: any[] = [];
    
    parser.on(EVENTS.CDATA, (xpath, content) => {
      cdataContents.push({ xpath, content });
    });
    
    parser.on('end', () => {
      expect(cdataContents.length).toBe(1);
      expect(cdataContents[0].content).toBe('This is CDATA content');
      done();
    });
    
    parser.write('<div><![CDATA[This is CDATA content]]></div>');
    parser.end();
  });

  test('HTML with DOCTYPE', done => {
    const doctypes: any[] = [];
    
    parser.init();
    parser.on(EVENTS.DOCTYPE, (doctype) => {
      doctypes.push(doctype);
    });
    
    parser.on('end', () => {
      expect(doctypes.length).toBe(1);
      expect(doctypes[0]).toBe('html');
      done();
    });
    
    parser.write('<!DOCTYPE html><html><body>Test</body></html>');
    parser.end();
  });

  test('HTML with processing instruction', done => {
    const instructions: any[] = [];
    
    parser.init();
    parser.on(EVENTS.INSTRUCTION, (name, attributes) => {
      instructions.push({ name, attributes });
    });
    
    parser.on('end', () => {
      expect(instructions.length).toBe(1);
      expect(instructions[0].name).toBe('xml');
      expect(instructions[0].attributes.version).toBe('1.0');
      expect(instructions[0].attributes.encoding).toBe('UTF-8');
      done();
    });
    
    parser.write('<?xml version="1.0" encoding="UTF-8"?><root>Test</root>');
    parser.end();
  });

  test('HTML with comments', done => {
    const openTags: any[] = [];
    const textContents: any[] = [];
    
    parser.init();
    parser.on(EVENTS.OPEN_TAG, (xpath, name, attributes) => {
      openTags.push({ xpath, name });
    });
    
    parser.on(EVENTS.TEXT, (xpath, text) => {
      textContents.push({ xpath, text });
    });
    
    parser.on('end', () => {
      // Comments should be ignored
      expect(openTags.length).toBe(1);
      expect(textContents.length).toBe(1);
      expect(textContents[0].text).toBe('Test');
      done();
    });
    
    parser.write('<div><!-- This is a comment -->Test</div>');
    parser.end();
  });

  test('HTML with XPath tracking', done => {
    const xpaths: string[] = [];
    
    parser.init();
    parser.on(EVENTS.OPEN_TAG, (xpath, name, attributes) => {
      xpaths.push(xpath);
    });
    
    parser.on('end', () => {
      expect(xpaths.length).toBe(3);
      expect(xpaths[0]).toBe('/div[1]');
      expect(xpaths[1]).toBe('/div[1]/p[1]');
      expect(xpaths[2]).toBe('/div[1]/p[1]/span[1]');
      done();
    });
    
    parser.write('<div><p><span>Test</span></p></div>');
    parser.end();
  });

  test('HTML with multiple same tags (XPath indexing)', done => {
    const xpaths: string[] = [];
    
    parser.init();
    parser.on(EVENTS.OPEN_TAG, (xpath, name, attributes) => {
      xpaths.push(xpath);
    });

    parser.on(EVENTS.TEXT, (xpath, text) => {
      xpaths.push(xpath);
    });
    
    parser.on('end', () => {
      expect(xpaths.length).toBe(8);
      expect(xpaths[0]).toBe('/div[1]');
      expect(xpaths[1]).toBe('/div[1]/p[1]');
      expect(xpaths[2]).toBe('/div[1]/p[1]/$$TEXTNODE[1]');
      expect(xpaths[3]).toBe('/div[1]/p[2]');
      expect(xpaths[4]).toBe('/div[1]/p[2]/$$TEXTNODE[1]');
      expect(xpaths[5]).toBe('/div[1]/p[3]');
      expect(xpaths[6]).toBe('/div[1]/p[3]/span[1]');
      expect(xpaths[7]).toBe('/div[1]/p[3]/span[1]/$$TEXTNODE[1]');
      done();
    });
    
    parser.write('<div><p>First</p><p>Second</p><p><span>Third</span></p></div>');
    parser.end();
  });

  test('HTML parsing with trace method', done => {
    const openTags: any[] = [];
    
    parser.init();
    parser.on(EVENTS.OPEN_TAG, (xpath, name, attributes) => {
      openTags.push({ xpath, name });
    });
    
    parser.on('end', () => {
      expect(openTags.length).toBe(1);
      expect(openTags[0].name).toBe('div');
      done();
    });
    
    parser.trace('<div>Test</div>');
    parser.end();
  });
});