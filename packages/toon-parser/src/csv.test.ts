import { describe, it, expect } from 'vitest';
import { csvToToon } from './csv';

describe('csvToToon', () => {
  it('converts simple CSV with header to table', () => {
    const csv = `id,name,role
1,Alice,Admin
2,Bob,User`;
    const toon = csvToToon(csv);
    expect(toon).toContain('[2]{id,name,role}:');
    expect(toon).toContain('1,Alice,Admin');
    expect(toon).toContain('2,Bob,User');
  });

  it('handles quoted values', () => {
    const csv = `id,desc
1,"Hello, World"`;
    const toon = csvToToon(csv);
    expect(toon).toContain('"Hello, World"');
  });
  
  it('handles headerless csv', () => {
     const csv = `1,2\n3,4`;
     const toon = csvToToon(csv, { hasHeader: false });
     expect(toon).toContain('- [2]: 1,2');
     expect(toon).toContain('- [2]: 3,4');
  });
});
