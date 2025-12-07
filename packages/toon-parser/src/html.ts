import { parse, HTMLElement, Node, NodeType } from 'node-html-parser';
import { jsonToToon, JsonToToonOptions } from './index.js';

export function htmlToToon(html: string, options: JsonToToonOptions = {}): string {
  validateWellFormedHtml(html);
  const root = parse(html);
  // remove whitespace-only text nodes for clean output
  removeWhitespace(root);
  // parse children of the root shell
  const children = root.childNodes.map(n => nodeToJson(n)).filter(x => x !== null);

  if (children.length === 1) {
      return jsonToToon(children[0], options);
  }
  return jsonToToon(children, options);
}

type HtmlJsonNode = {
  tag?: string;
  text?: string;
  children?: HtmlJsonNode[];
  attrs?: Record<string, string>;
};

/**
 * Parse HTML into a simplified JSON structure (used for edge-case tests).
 * Throws when tags are unbalanced (very lightweight validation).
 */
export function htmlToJson(html: string): { children: HtmlJsonNode[] } {
  validateWellFormedHtml(html);
  const root = parse(html);
  removeWhitespace(root);
  const children = root.childNodes
    .map(convertNode)
    .filter((n): n is HtmlJsonNode => n !== null);
  return { children };
}

function removeWhitespace(node: Node) {
  if (node.childNodes && node.childNodes.length > 0) {
    for (let i = node.childNodes.length - 1; i >= 0; i--) {
       const child = node.childNodes[i];
       if (!child) continue;
       if (child.nodeType === NodeType.TEXT_NODE) {
          if (child.text.trim().length === 0) {
             node.childNodes.splice(i, 1);
          }
       } else if (child.nodeType === NodeType.ELEMENT_NODE) {
          removeWhitespace(child);
       }
    }
  }
}

function nodeToJson(node: Node): unknown {
  if (node.nodeType === NodeType.TEXT_NODE) {
    return node.text.trim();
  }
  
  if (node.nodeType === NodeType.ELEMENT_NODE) {
    const el = node as HTMLElement;
    const obj: Record<string, unknown> = {};
    const tagName = el.tagName.toLowerCase();
    
    // Attributes
    for (const [key, val] of Object.entries(el.attributes)) {
      obj[`@_${key}`] = val;
    }
    
    // Children
    if (el.childNodes.length > 0) {
      // If only one text child, simplify: div: "text"
      const firstChild = el.childNodes[0];
      if (el.childNodes.length === 1 && firstChild && firstChild.nodeType === NodeType.TEXT_NODE) {
         const text = firstChild.text.trim();
         // If we have attributes, we must keep obj structure: { div: { @class: "foo", #text: "text" } }
         if (Object.keys(obj).length === 0) {
            return { [tagName]: text };
         }
         obj['#text'] = text;
      } else {
         const processedChildren = el.childNodes.map(nodeToJson).filter(x => x !== null);
         // For mixed content or multiple children, using a dedicated children array is safest
         // tailored for Toon's "list of objects" preference.
         obj['#children'] = processedChildren;
      }
    } else {
       // Empty element
       if (Object.keys(obj).length === 0) {
           return { [tagName]: '' };
       }
    }
    
    // If we only have attributes and no content, return { div: { @attr: val } }
    return { [tagName]: obj };
  }
  
  return null;
}

function convertNode(node: Node): HtmlJsonNode | null {
  if (node.nodeType === NodeType.TEXT_NODE) {
    const text = node.text.trim();
    return text.length > 0 ? { text } : null;
  }

  if (node.nodeType === NodeType.ELEMENT_NODE) {
    const el = node as HTMLElement;
    const entry: HtmlJsonNode = {
      tag: el.tagName.toLowerCase(),
    };

    const attrs = Object.entries(el.attributes);
    if (attrs.length > 0) {
      entry.attrs = Object.fromEntries(attrs);
    }

    const childJson = el.childNodes
      .map(convertNode)
      .filter((c): c is HtmlJsonNode => c !== null);

    const textOnly = childJson.length === 1 && childJson[0].text && !childJson[0].tag;
    if (textOnly) {
      entry.text = childJson[0].text;
    } else if (childJson.length > 0) {
      entry.children = childJson.map(child => {
        // collapse pure text nodes under children into `{ text }`
        if (!child.tag && child.text) return { text: child.text };
        return child;
      });
    }

    return entry;
  }

  return null;
}

// Minimal stack-based validation to catch obvious unclosed tags.
function validateWellFormedHtml(html: string): void {
  const voidTags = new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr']);
  const tagRegex = /<\/?([a-zA-Z0-9]+)[^>]*>/g;
  const stack: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = tagRegex.exec(html)) !== null) {
    const [full, tag] = match;
    const lower = tag.toLowerCase();
    const isClosing = full.startsWith('</');
    if (voidTags.has(lower)) continue;
    if (!isClosing) {
      stack.push(lower);
    } else {
      const top = stack.pop();
      if (top !== lower) {
        throw new Error(`Malformed HTML: unexpected closing tag </${lower}>`);
      }
    }
  }
  if (stack.length > 0) {
    throw new Error(`Malformed HTML: unclosed tag <${stack[stack.length - 1]}>`);
  }
}
