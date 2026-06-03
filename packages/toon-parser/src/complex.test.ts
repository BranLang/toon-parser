import { describe, it, expect } from 'vitest';
import { csvToToon, htmlToToon, urlToToon } from './index';

describe('Complex Scenarios', () => {
    describe('CSV Complex Escaping', () => {
        it('handles newlines and escaped quotes inside quoted fields', () => {
            // CSV:
            // "note","data"
            // "line1\nline2","has ""quotes"" inside"
            const csv = `"note","data"\n"line1\nline2","has ""quotes"" inside"`;
            const toon = csvToToon(csv);
            // toon-parser usually tries to preserve strings.
            // But complex multiline values might just be quoted string literals.
            expect(toon).toContain('"line1\\nline2"');
            // Toon uses JSON.stringify for primitives, so " becomes \"
            expect(toon).toContain('"has \\"quotes\\" inside"'); 
        });
    });

    describe('HTML Deep Nesting & Attributes', () => {
        it('preserves attributes in deeply nested lists', () => {
            const html = `<ul>
              <li class="item" data-id="1">Item 1</li>
              <li class="item" data-id="2">Item 2</li>
            </ul>`;
            const toon = htmlToToon(html);
            expect(toon).toContain('ul:');
            // List of objects where each object has key 'li'.
            // Format:
            // -
            //   li:
            //     ...
            expect(toon).toContain('li:');
            expect(toon).toContain('"@_class": item');
            expect(toon).toContain('"@_data-id": "1"');
        });
    });

    describe('URL Array Syntax', () => {
        it('expands bracket notation deeply with push idiom', () => {
             const url = 'sort[order]=asc&sort[fields][]=name&sort[fields][]=date';
             const toon = urlToToon(url);
             expect(toon).toContain('sort:');
             expect(toon).toContain('order: asc');
             expect(toon).toContain('fields[2]: name,date');
        });
    });
});
