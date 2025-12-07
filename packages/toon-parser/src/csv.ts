import { jsonToToon, JsonToToonOptions } from './index.js';

export interface CsvToToonOptions extends Omit<JsonToToonOptions, 'delimiter'> {
  /**
   * Character used to separate fields. Defaults to comma.
   */
  delimiter?: string;
  /**
   * If true, the first row is treated as the header row.
   * If false, the output will be a list of arrays instead of a tabular array.
   * Defaults to true.
   */
  hasHeader?: boolean;
}

export function csvToToon(csv: string, options: CsvToToonOptions = {}): string {
  const delimiter = options.delimiter ?? ',';
  const hasHeader = options.hasHeader ?? true;

  const rows: string[][] = parseCsv(csv, delimiter);

  if (rows.length === 0) {
    return jsonToToon([], options as JsonToToonOptions);
  }

  if (hasHeader) {
    const header = rows[0];
    if (!header) return jsonToToon([], options as JsonToToonOptions);
    
    const data = rows.slice(1).map(row => {
      const obj: Record<string, unknown> = {};
      header.forEach((key, index) => {
        obj[key] = inferType(row[index] ?? '');
      });
      return obj;
    });
    return jsonToToon(data, options as JsonToToonOptions);
  } else {
    // No header: array of arrays
    const data = rows.map(row => row.map(cell => inferType(cell)));
    return jsonToToon(data, options as JsonToToonOptions);
  }
}

function parseCsv(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let inQuote = false;
  
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (inQuote) {
      if (char === '"') {
        if (nextChar === '"') {
          currentCell += '"';
          i++; // skip escaped quote
        } else {
          inQuote = false;
        }
      } else {
        currentCell += char;
      }
    } else {
      if (char === '"') {
        inQuote = true;
      } else if (char === delimiter) {
        currentRow.push(currentCell);
        currentCell = '';
      } else if (char === '\r' || char === '\n') {
        if (char === '\r' && nextChar === '\n') i++;
        currentRow.push(currentCell);
        rows.push(currentRow);
        currentRow = [];
        currentCell = '';
      } else {
        currentCell += char;
      }
    }
  }
  
  // Flush last cell/row
  if (currentCell || currentRow.length > 0) {
     currentRow.push(currentCell);
     rows.push(currentRow);
  }
  
  // Clean up empty trailing row if common in file save
  if (rows.length > 0) {
     const last = rows[rows.length - 1];
     if (last && last.length === 1 && last[0] === '') {
         rows.pop();
     }
  }

  return rows;
}

function inferType(val: string): string | number | boolean {
  if (val === 'true') return true;
  if (val === 'false') return false;
  if (val === 'null') return 'null'; // keep string null? or null value? usually string in CSV
  // Attempt number conversion
  if (val.trim() === '') return '';
  const num = Number(val);
  if (!isNaN(num) && !val.includes(',')) { // simple check
     return num;
  }
  return val;
}
