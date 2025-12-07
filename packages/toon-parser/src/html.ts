import { parse, HTMLElement, Node, NodeType } from 'node-html-parser';
import { jsonToToon, JsonToToonOptions } from './index.js';

export function htmlToToon(html: string, options: JsonToToonOptions = {}): string {
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
