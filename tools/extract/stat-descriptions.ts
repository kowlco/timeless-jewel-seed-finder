// Parser for GGG's stat_descriptions.txt (UTF-16LE). Produces a map of
// stat string-id -> English label with value placeholders shown as `#`.
// Format per block:
//   description
//     <count> id1 id2 ...
//     <numLines>
//       <ranges>|<ranges> "English text with {0} {1}" [flags]
//     lang "Thai"
//       ...            (other languages follow; we only take the default = English)
export function parseStatDescriptions(buf: Uint8Array): Map<string, string> {
  const text = new TextDecoder('utf-16le').decode(buf);
  const lines = text.split(/\r?\n/);
  const map = new Map<string, string>();

  let i = 0;
  const intAt = (s: string) => parseInt(s.trim(), 10);
  while (i < lines.length) {
    if (lines[i].trim() !== 'description') {
      i++;
      continue;
    }
    i++; // consume 'description'
    if (i >= lines.length) break;
    const idParts = lines[i].trim().split(/\s+/);
    i++;
    const count = intAt(idParts[0]);
    const ids = idParts.slice(1, 1 + count);
    if (i >= lines.length) break;
    const numLines = intAt(lines[i]);
    i++;
    let firstText: string | null = null;
    for (let k = 0; k < numLines && i < lines.length; k++, i++) {
      if (firstText === null) {
        const m = lines[i].match(/"([^"]*)"/);
        if (m) firstText = m[1];
      }
    }
    if (firstText) {
      const human = firstText.replace(/\{\d+(:[^}]*)?\}/g, '#').replace(/\s+/g, ' ').trim();
      for (const id of ids) if (!map.has(id)) map.set(id, human);
    }
    // remaining `lang "..."` sections skip naturally: none of their lines equal 'description'.
  }
  return map;
}
