#!/usr/bin/env node
/**
 * Canonical Fact Schema 校验脚本（Wave 0 / T0.1）
 *
 * 用途：
 *   1. 编译两份 JSON Schema，证明 schema 自身合法；
 *   2. examples/valid/*.json 必须全部通过校验；
 *   3. examples/invalid/*.json 必须全部被拒绝。
 *
 * 运行（仓库根目录）：
 *   node openspec/changes/establish-session-foundation-contracts/schemas/validate.mjs
 *
 * 依赖：仅使用仓库 node_modules 中已有的 ajv（draft-07，ajv 6/8 均可）。
 * ajv 缺失或 API 不兼容时明确报错退出，不静默跳过。
 */
import { createRequire } from "node:module";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../../..");
const require = createRequire(join(repoRoot, "package.json"));

let Ajv;
try {
  Ajv = require("ajv");
} catch {
  console.error(
    "[validate-schemas] 无法从仓库 node_modules 解析 ajv。请先执行 npm install；本脚本不引入新依赖。"
  );
  process.exit(2);
}

const ajv = new Ajv({ allErrors: true, strict: false });

const entrySchema = JSON.parse(
  readFileSync(join(here, "shared-canonical-entry.schema.json"), "utf8")
);
const aggregateSchema = JSON.parse(
  readFileSync(join(here, "provider-usage-aggregate.schema.json"), "utf8")
);

let validateEntry;
let validateAggregate;
try {
  validateEntry = ajv.compile(entrySchema);
  validateAggregate = ajv.compile(aggregateSchema);
} catch (error) {
  console.error("[validate-schemas] Schema 编译失败：", error.message);
  process.exit(2);
}

const AGGREGATE_TYPE = "provider.usageAggregateRecorded";

function pickValidator(sample) {
  // Provider Usage Ledger entry 独立 schema：无 envelope 的 factType 字段。
  return sample.type === AGGREGATE_TYPE && sample.factType === undefined
    ? validateAggregate
    : validateEntry;
}

function listJson(dir) {
  return readdirSync(join(here, dir))
    .filter((name) => name.endsWith(".json"))
    .sort();
}

let failures = 0;

for (const name of listJson("examples/valid")) {
  const sample = JSON.parse(readFileSync(join(here, "examples/valid", name), "utf8"));
  const validate = pickValidator(sample);
  const ok = validate(sample);
  if (ok) {
    console.log(`PASS  valid/${name}`);
  } else {
    failures += 1;
    console.error(`FAIL  valid/${name} 应通过但被拒绝：`);
    console.error(JSON.stringify(validate.errors, null, 2));
  }
}

for (const name of listJson("examples/invalid")) {
  const sample = JSON.parse(readFileSync(join(here, "examples/invalid", name), "utf8"));
  const validate = pickValidator(sample);
  const ok = validate(sample);
  if (ok) {
    failures += 1;
    console.error(`FAIL  invalid/${name} 应被拒绝但通过了`);
  } else {
    const first = validate.errors?.[0];
    console.log(
      `PASS  invalid/${name} 已拒绝（${first?.instancePath || "/"} ${first?.message ?? ""}）`
    );
  }
}

if (failures > 0) {
  console.error(`\n[validate-schemas] ${failures} 个用例不符合预期。`);
  process.exit(1);
}
console.log("\n[validate-schemas] 全部用例符合预期。");
