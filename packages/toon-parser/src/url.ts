import { jsonToToon, JsonToToonOptions } from './index.js';

export function urlToToon(urlString: string, options: JsonToToonOptions = {}): string {
  // If full URL, extract search params. If just params, use as is.
  let search = urlString;
  try {
    const u = new URL(urlString);
    search = u.search;
  } catch {
    // likely just a query string part or relative path
    const qIndex = urlString.indexOf('?');
    if (qIndex !== -1) {
      search = urlString.slice(qIndex);
    }
  }

  const params = new URLSearchParams(search);
  const obj: Record<string, unknown> = {};

  for (const [key, value] of params.entries()) {
    assignDeep(obj, key, value);
  }

  return jsonToToon(obj, options);
}

function assignDeep(obj: Record<string, unknown>, key: string, value: string): void {
  // Handle "key[subkey]" or "key.subkey" notation roughly
  // For safety and simplicity, we'll try to support basic bracket notation commonly used in QS
  // e.g. "filters[date][start]" -> filters: { date: { start: value } }

  const parts = key.split(/\[|\]\[|\]|\./).filter(Boolean);
  
  if (parts.length === 0) return;

  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (part === undefined) continue;
    
    if (!(part in current) || typeof current[part] !== 'object' || current[part] === null) {
        current[part] = {};
    }
    current = current[part] as Record<string, unknown>;
  }
  
  const last = parts[parts.length - 1];
  if (last === '' || last === undefined) { 
      return; 
  }
  
  const typed = inferType(value);
  current[last] = typed;
}


function inferType(val: string): string | number | boolean {
  if (val === 'true') return true;
  if (val === 'false') return false;
  const num = Number(val);
  if (!isNaN(num) && val.trim() !== '') return num;
  return val;
}
