import { describe, it, expect } from 'vitest';
import { htmlToToon } from './html';

describe('htmlToToon', () => {
  it('converts simple html', () => {
    const html = '<div class="foo">Hello</div>';
    const toon = htmlToToon(html);
    // div:
    //   "@_class": foo
    //   "#text": Hello
    expect(toon).toContain('div:');
    expect(toon).toContain('"@_class": foo');
    expect(toon).toContain('"#text": Hello');
  });

  it('converts nested structure', () => {
    const html = '<ul><li>A</li><li>B</li></ul>';
    const toon = htmlToToon(html);
    // ul:
    //   "#children"[2]{li}:
    //     A
    //     B
    expect(toon).toContain('ul:');
    expect(toon).toContain('li'); // header field
    expect(toon).toContain('A');
    expect(toon).toContain('B');
  });
  
  it('converts mixed content', () => {
     const html = '<p>Hello <b>World</b></p>';
     const toon = htmlToToon(html);
     // p:
     //   "#children"[2]:
     //      - Hello
     //      - b: World
     expect(toon).toContain('p:');
     expect(toon).toContain('"#children"[2]:');
     expect(toon).toContain('- Hello');
     // array items are expanded because they are mixed types
     expect(toon).toContain('b: World');
  });
});
