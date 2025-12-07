import { 
  csvToToon, 
  htmlToToon, 
  urlToToon, 
  logToToon 
} from 'toon-parser';

console.log('--- CSV Parsing ---');
const csv = `id,name,role
1,Alice,Admin
2,Bob,User`;
console.log(csvToToon(csv));

console.log('\n--- HTML Parsing ---');
const html = `<div class="card">
  <h3>Profile</h3>
  <ul><li>Name: Alice</li><li>Role: Admin</li></ul>
</div>`;
console.log(htmlToToon(html));

console.log('\n--- URL Parsing ---');
const url = 'https://api.example.com/search?q=toon&filters[type]=doc&filters[recent]=true';
console.log(urlToToon(url));

console.log('\n--- Log Parsing ---');
const log = `192.168.1.1 - - [10/Oct:12:00:00] "GET /index.html" 200 1024
192.168.1.2 - - [10/Oct:12:00:01] "GET /app.js" 200 4096`;
console.log(logToToon(log));
