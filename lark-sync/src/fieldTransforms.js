export function mapRecordFields(record, fieldMap) {
  const output = {};
  const sourceFields = record.fields ?? {};

  for (const [destinationField, rule] of Object.entries(fieldMap)) {
    const sourceValue = sourceFields[rule.from];
    const value = transformValue(sourceValue, rule.transform ?? "raw");

    if (value !== undefined) {
      output[destinationField] = value;
    }
  }

  return output;
}

export function transformValue(value, transform) {
  switch (transform) {
    case "raw":
      return value;
    case "text":
      return toPlainText(value);
    case "attachment":
      return normalizeAttachment(value);
    case "singleSelectValue":
      return value?.value?.[0] ?? value;
    default:
      throw new Error(`Unknown transform: ${transform}`);
  }
}

export function toPlainText(value) {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);

  if (Array.isArray(value)) {
    return value.map(toPlainText).filter(Boolean).join("\n");
  }

  if (typeof value === "object") {
    if (typeof value.text === "string") return value.text;
    if (typeof value.name === "string") return value.name;
    if (Array.isArray(value.value)) return value.value.map(toPlainText).filter(Boolean).join("\n");
  }

  return JSON.stringify(value);
}

export function normalizeAttachment(value) {
  if (value == null) return [];
  const items = Array.isArray(value) ? value : [value];

  return items
    .map((item) => {
      if (!item || typeof item !== "object") return undefined;
      if (item.file_token) return item;
      if (item.token) return { ...item, file_token: item.token };
      return item;
    })
    .filter(Boolean);
}
