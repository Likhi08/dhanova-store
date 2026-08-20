import { readFile } from "node:fs/promises";
import { unzipSync } from "fflate";
import { XMLParser } from "fast-xml-parser";

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_", parseTagValue: false, removeNSPrefix: true });
const decoder = new TextDecoder();

type XmlValue = Record<string, unknown> | string | number | undefined;
export type XlsxRow = Map<string, string>;

function asArray<T>(value: T | T[] | undefined): T[] {
  return value === undefined ? [] : Array.isArray(value) ? value : [value];
}

function textContent(value: XmlValue): string {
  if (value === undefined || value === null) return "";
  if (typeof value !== "object") return String(value);
  if ("#text" in value) return String(value["#text"] ?? "");
  if (value.t !== undefined) return textContent(value.t as XmlValue);
  return asArray(value.r as Record<string, unknown> | Record<string, unknown>[] | undefined)
    .map((run) => textContent(run.t as XmlValue))
    .join("");
}

export async function readXlsxSheet(filePath: string, sheetName: string): Promise<XlsxRow[]> {
  const archive = unzipSync(new Uint8Array(await readFile(filePath)));
  const readXml = (name: string) => {
    const entry = archive[name];
    if (!entry) throw new Error(`Workbook entry is missing: ${name}`);
    return parser.parse(decoder.decode(entry)) as Record<string, unknown>;
  };
  const sharedXml = archive["xl/sharedStrings.xml"] ? readXml("xl/sharedStrings.xml") : undefined;
  const sharedStrings = asArray((sharedXml?.sst as Record<string, unknown> | undefined)?.si as XmlValue | XmlValue[] | undefined)
    .map((item) => textContent(item));
  const workbook = readXml("xl/workbook.xml");
  const relationships = readXml("xl/_rels/workbook.xml.rels");
  const relationshipMap = new Map(
    asArray((relationships.Relationships as Record<string, unknown>).Relationship as Record<string, unknown> | Record<string, unknown>[])
      .map((relationship) => [String(relationship["@_Id"]), String(relationship["@_Target"])]),
  );
  const sheets = asArray(((workbook.workbook as Record<string, unknown>).sheets as Record<string, unknown>).sheet as Record<string, unknown> | Record<string, unknown>[]);
  const selected = sheets.find((sheet) => String(sheet["@_name"]) === sheetName);
  if (!selected) throw new Error(`The workbook does not contain a "${sheetName}" sheet.`);
  const target = relationshipMap.get(String(selected["@_id"]));
  if (!target) throw new Error(`The ${sheetName} sheet relationship is missing.`);
  const sheetPath = target.startsWith("/") ? target.slice(1) : `xl/${target}`;
  const sheet = readXml(sheetPath);
  const rows = asArray((((sheet.worksheet as Record<string, unknown>).sheetData as Record<string, unknown>).row) as Record<string, unknown> | Record<string, unknown>[]);
  const cellValue = (cell: Record<string, unknown>) => {
    if (String(cell["@_t"] ?? "") === "inlineStr") return textContent(cell.is as XmlValue);
    const raw = textContent(cell.v as XmlValue);
    return String(cell["@_t"] ?? "") === "s" ? sharedStrings[Number(raw)] ?? "" : raw;
  };
  return rows.map((row) => new Map(
    asArray(row.c as Record<string, unknown> | Record<string, unknown>[])
      .map((cell) => [String(cell["@_r"]).replace(/\d+/g, ""), cellValue(cell)]),
  ));
}
