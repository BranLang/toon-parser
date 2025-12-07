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
     // user:
     //   name: Alice
     //   age: 30
     // filter:
     //   sort: asc
     expect(toon).toContain('user:');
     expect(toon).toContain('name: Alice');
     expect(toon).toContain('age: 30');
     expect(toon).toContain('filter:');
     expect(toon).toContain('sort: asc');
  });
});
