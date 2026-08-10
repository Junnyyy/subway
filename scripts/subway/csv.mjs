import { createReadStream, readFileSync } from "node:fs";
import { createInterface } from "node:readline";

export function parseCsvLine(line) {
  const fields = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (quoted) {
      if (character === '"' && line[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
    } else if (character === '"') {
      quoted = true;
    } else if (character === ",") {
      fields.push(field);
      field = "";
    } else {
      field += character;
    }
  }

  fields.push(field.replace(/\r$/, ""));
  return fields;
}

function recordFromFields(headers, fields) {
  if (fields.length !== headers.length) return null;
  return Object.fromEntries(headers.map((header, index) => [header, fields[index]]));
}

export function readCsv(filePath) {
  const lines = readFileSync(filePath, "utf8").split(/\n/).filter(Boolean);
  const headers = parseCsvLine(lines.shift() ?? "");
  return lines
    .map((line) => recordFromFields(headers, parseCsvLine(line)))
    .filter(Boolean);
}

export async function* streamCsv(filePath) {
  const input = createReadStream(filePath, { encoding: "utf8" });
  const lines = createInterface({ input, crlfDelay: Infinity });
  let headers;

  for await (const line of lines) {
    if (!headers) {
      headers = parseCsvLine(line);
      continue;
    }
    const record = recordFromFields(headers, parseCsvLine(line));
    if (record) yield record;
  }
}
