// Copy committed data tables into public/ so the browser can fetch them at runtime
// (single-result transform for the socket breakdown + tree render).
import { cpSync, readFileSync } from 'node:fs';
const v = JSON.parse(readFileSync('data/current.json', 'utf8')).treeVersion;
cpSync(`data/${v}`, `public/data/${v}`, { recursive: true });
console.log('assets copied for', v);
