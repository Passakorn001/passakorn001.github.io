import { existsSync, readFileSync } from "node:fs";
import { loadDotEnv, envFlag } from "./env.js";
import { LarkClient } from "./larkClient.js";
import { mapRecordFields } from "./fieldTransforms.js";

loadDotEnv();

const configPath = process.env.CONFIG_PATH || "config.json";
const dryRun = envFlag("DRY_RUN", true);
const deleteAfterSync = envFlag("DELETE_AFTER_SYNC", false);
const markSynced = envFlag("MARK_SYNCED", false);

const config = loadConfig(configPath);
const client = new LarkClient({
  appId: process.env.LARK_APP_ID,
  appSecret: process.env.LARK_APP_SECRET
});

const source = config.source;
const destination = config.destination;
const afterSync = config.afterSync ?? {};

if (destination.type !== "base") {
  throw new Error(`Unsupported destination.type: ${destination.type}. This version supports "base".`);
}

console.log(`Starting Lark sync. dryRun=${dryRun}, deleteAfterSync=${deleteAfterSync}, markSynced=${markSynced}`);

const records = await client.listBitableRecords(source);
const selectedRecords = records.slice(0, source.maxRecordsPerRun ?? records.length);

console.log(`Fetched ${records.length} source records. Processing ${selectedRecords.length}.`);

let created = 0;
let deleted = 0;
let marked = 0;
let skipped = 0;

for (const record of selectedRecords) {
  const recordId = record.record_id;
  const fields = mapRecordFields(record, destination.fieldMap);

  if (!Object.keys(fields).length) {
    console.warn(`Skipping ${recordId}: mapped fields are empty.`);
    skipped += 1;
    continue;
  }

  console.log(`Prepared ${recordId}: ${JSON.stringify(fields)}`);

  if (dryRun) {
    skipped += 1;
    continue;
  }

  await client.createBitableRecord({
    appToken: destination.appToken,
    tableId: destination.tableId,
    fields
  });
  created += 1;

  if (deleteAfterSync || afterSync.deleteSourceRecord) {
    await client.batchDeleteBitableRecords({
      appToken: source.appToken,
      tableId: source.tableId,
      recordIds: [recordId]
    });
    deleted += 1;
  } else if (markSynced || afterSync.markSourceRecord?.enabled) {
    const marker = afterSync.markSourceRecord ?? {};
    await client.updateBitableRecord({
      appToken: source.appToken,
      tableId: source.tableId,
      recordId,
      fields: {
        [marker.field || "Synced"]: marker.value ?? true
      }
    });
    marked += 1;
  }
}

console.log(
  JSON.stringify(
    {
      fetched: records.length,
      processed: selectedRecords.length,
      created,
      deleted,
      marked,
      skipped,
      dryRun
    },
    null,
    2
  )
);

function loadConfig(path) {
  if (process.env.CONFIG_JSON) {
    return JSON.parse(process.env.CONFIG_JSON);
  }

  if (!existsSync(path)) {
    throw new Error(
      `Missing ${path}. Copy config.example.json to config.json or set CONFIG_JSON.`
    );
  }

  return JSON.parse(readFileSync(path, "utf8"));
}
