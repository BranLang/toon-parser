import { XMLParser, XMLValidator, X2jOptions } from 'fast-xml-parser';
import { jsonToToon, JsonToToonOptions } from './index.js';

export interface XmlToToonOptions extends JsonToToonOptions {
  /**
   * Options passed directly to fast-xml-parser.
   * Defaults to:
   * {
   *   ignoreAttributes: false,
   *   attributeNamePrefix: '@_',
   *   parseAttributeValue: true,
   *   ignoreDeclaration: true
   * }
   */
  xmlOptions?: Partial<X2jOptions>;
}

const DEFAULT_XML_OPTIONS: Partial<X2jOptions> = {
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseAttributeValue: true,
  ignoreDeclaration: true,
  // Ensure arrays are created for repeated elements appropriately
  // This is a common pain point in XML->JSON.
  // We refrain from forcing everything to arrays to keep simple structures simple,
  // but users can override this via xmlOptions.
};

/**
 * Parses an XML string and converts it directly to TOON format.
 * 
 * @param xml The XML string to parse.
 * @param options TOON formatting options plus optional `xmlOptions` for the parser.
 * @returns The resulting TOON string.
 */
export function xmlToToon(xml: string, options: XmlToToonOptions = {}): string {
  const trimmed = xml.trim();
  if (!trimmed) {
    return jsonToToon({}, options);
  }

  const validation = XMLValidator.validate(xml);
  if (validation !== true) {
    throw new Error('Malformed XML');
  }

  const parser = new XMLParser({
    ...DEFAULT_XML_OPTIONS,
    ...options.xmlOptions
  });

  const jsonObj = parser.parse(xml);
  return jsonToToon(jsonObj, options);
}

export function xmlToJson(xml: string, options: XmlToToonOptions = {}): unknown {
  if (!xml.trim()) return {};

  const validation = XMLValidator.validate(xml);
  if (validation !== true) {
    throw new Error('Malformed XML');
  }

  const parser = new XMLParser({
    ...DEFAULT_XML_OPTIONS,
    ...options.xmlOptions
  });

  return parser.parse(xml);
}
