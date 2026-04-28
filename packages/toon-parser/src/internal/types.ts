export type JsonPrimitive = string | number | boolean | null;

export type Delimiter = ',' | '|' | '\t';

export interface Limits {
  maxDepth: number;
  maxArrayLength: number;
  maxTotalNodes: number;
  disallowedKeys: string[];
  maxInputLength: number;
}

export type Container =
  | { type: 'object'; value: Record<string, unknown>; indent: number }
  | {
      type: 'list';
      value: unknown[];
      indent: number;
      expectedLength: number | null;
      delimiter: Delimiter;
    }
  | {
      type: 'tabular';
      value: Record<string, unknown>[];
      indent: number;
      expectedLength: number;
      delimiter: Delimiter;
      fields: string[];
    }
  | {
      type: 'placeholder';
      indent: number;
      filled: boolean;
      current?: { value: Record<string, unknown>; indent: number };
      assign: (value: unknown) => void;
    };
