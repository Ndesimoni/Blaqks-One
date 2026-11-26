/**
 * Minimal DOMParser stand-in for Node unit tests of the workbook reader. It supports the
 * well-formed SpreadsheetML that the CRM writes: elements, attributes, text and entities.
 */
const entities = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const decode = (text) =>
  text.replace(/&(amp|lt|gt|quot|apos|#\d+);/g, (_, name) =>
    name.startsWith('#') ? String.fromCharCode(Number(name.slice(1))) : entities[name],
  );

class XmlNode {
  constructor(name = '#document', attributes = {}) {
    this.name = name;
    this.localName = name.includes(':') ? name.split(':').pop() : name;
    this.attributes = attributes;
    this.childNodes = [];
    this.text = '';
  }

  get textContent() {
    return this.text + this.childNodes.map((node) => node.textContent).join('');
  }

  getAttribute(name) {
    return this.attributes[name] ?? null;
  }

  getAttributeNS(_namespace, localName) {
    const key = Object.keys(this.attributes).find((name) => name.endsWith(`:${localName}`));
    return key ? this.attributes[key] : null;
  }

  getElementsByTagNameNS(_namespace, localName) {
    return this.childNodes.flatMap((node) => [
      ...(node.localName === localName ? [node] : []),
      ...node.getElementsByTagNameNS(_namespace, localName),
    ]);
  }
}

class TextNode {
  constructor(text) {
    this.localName = '#text';
    this.textContent = text;
    this.childNodes = [];
  }

  getElementsByTagNameNS() {
    return [];
  }
}

function parseAttributes(source) {
  const attributes = {};
  for (const [, name, value] of source.matchAll(/([\w:.-]+)\s*=\s*"([^"]*)"/g))
    attributes[name] = decode(value);
  return attributes;
}

export class TestDOMParser {
  parseFromString(xml) {
    const document = new XmlNode();
    const stack = [document];
    const tokens = /<\?[\s\S]*?\?>|<(\/?)([\w:.-]+)([^>]*?)(\/?)>|([^<]+)/g;
    for (const [, closing, name, attributes, selfClosing, text] of xml.matchAll(tokens)) {
      const parent = stack[stack.length - 1];
      if (text !== undefined) {
        if (text.trim() || parent.localName === 't')
          parent.childNodes.push(new TextNode(decode(text)));
      } else if (closing) {
        if (stack.pop().name !== name) throw Error(`Unbalanced XML element ${name}.`);
      } else if (name) {
        const node = new XmlNode(name, parseAttributes(attributes));
        parent.childNodes.push(node);
        if (!selfClosing) stack.push(node);
      }
    }
    if (stack.length !== 1) throw Error('Unclosed XML element.');
    return document;
  }
}
