import { describe, it, expect } from 'vitest';
import { jsonToToon } from './index';

describe('snapshot tests for JSON -> TOON', () => {
  it('tabular snapshot', () => {
    const data = {
      readings: [
        { id: 1, a: 'x' },
        { id: 2, a: 'y' }
      ],
      list: [1, 2, 3]
    };
    const toon = jsonToToon(data);
    expect(toon).toMatchSnapshot();
  });

  it('nested snapshot', () => {
    const data = { project: { name: 'Test', version: '0.1' }, items: [{ id: 1 }, {}] };
    const toon = jsonToToon(data);
    expect(toon).toMatchSnapshot();
  });
});
