import { jsonToToon, toonToJson } from 'toon-parser';

const data = {
  project: { name: 'Field Report', version: '0.1.0' },
  people: ['ana', 'luis', 'sam'],
  readings: [
    { id: 1, location: 'mesa', temperatureC: 18.3, humidity: 0.22 },
    { id: 2, location: 'ridge', temperatureC: 14.9, humidity: 0.28 }
  ]
};

const toon = jsonToToon(data);
console.log('--- TOON ---');
console.log(toon);

const decoded = toonToJson(toon);
console.log('\nRound-trip OK:', JSON.stringify(decoded) === JSON.stringify(data));
