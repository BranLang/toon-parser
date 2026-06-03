import { describe, it, expect } from 'vitest';
import { urlToToon } from './url';

describe('urlToToon', () => {
  it('parses simple query string', () => {
    const qs = 'foo=bar&baz=123';
    const toon = urlToToon(qs);
    expect(toon).toContain('foo: bar');
    expect(toon).toContain('baz: 123');
  });

  it('handles full url', () => {
     const url = 'https://example.com/api?a=1';
     const toon = urlToToon(url);
     expect(toon).toContain('a: 1');
  });

  it('expands nested keys', () => {
     const qs = 'user[name]=Alice&user[age]=30&filter.sort=asc';
     const toon = urlToToon(qs);
     expect(toon).toContain('user:');
     expect(toon).toContain('name: Alice');
     expect(toon).toContain('age: 30');
     expect(toon).toContain('filter:');
     expect(toon).toContain('sort: asc');
  });

  describe('array bracket notation', () => {
    it('treats trailing [] as push idiom (single key)', () => {
      const toon = urlToToon('tags[]=a&tags[]=b&tags[]=c');
      // Inline primitive array form: tags[3]: a,b,c
      expect(toon).toContain('tags[3]: a,b,c');
    });

    it('treats trailing [] as push idiom inside nested path', () => {
      const toon = urlToToon('sort[fields][]=name&sort[fields][]=date');
      expect(toon).toContain('sort:');
      expect(toon).toContain('fields[2]: name,date');
    });

    it('creates an array when child segments are numeric indices', () => {
      const toon = urlToToon('arr[0]=a&arr[1]=b');
      expect(toon).toContain('arr[2]: a,b');
    });

    it('creates array of objects from numeric-index + nested keys', () => {
      const toon = urlToToon('arr[0][name]=alice&arr[0][age]=30&arr[1][name]=bob&arr[1][age]=25');
      // Should be a tabular array of two objects keyed by name+age.
      expect(toon).toContain('arr[2]{name,age}:');
      expect(toon).toContain('alice,30');
      expect(toon).toContain('bob,25');
    });

    it('preserves order when bracket indices appear out of order', () => {
      const toon = urlToToon('arr[1]=second&arr[0]=first');
      expect(toon).toContain('arr[2]: first,second');
    });
  });
});
