import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const settings = Object.fromEntries(read(".env.production").split(/\r?\n/)
  .filter((line) => line.trim() && !line.trim().startsWith("#"))
  .map((line) => { const index = line.indexOf("="); return [line.slice(0, index), line.slice(index + 1)]; }));
const api = "https://api.forest.tobeunicorn.kr";
for (const key of ["VITE_API_BASE_URL", "VITE_DASHBOARD_API_BASE_URL"]) {
  assert.equal(settings[key], api, `${key}: 운영 API 불일치`);
  assert.ok(read("Dockerfile").includes(`ARG ${key}=${api}`), `${key}: Docker 기본값 불일치`);
}
for (const key of ["VITE_LOCAL_E2E_ENABLED", "VITE_FIELD_MODE_ENABLED"]) {
  assert.equal(settings[key], "0", `${key}: 실데이터 검증에서 로컬 시험 모드 금지`);
}
for (const path of [".gitignore", ".dockerignore"]) {
  assert.ok(read(path).includes("!.env.production"), `${path}: 운영 설정 제외 금지`);
}
console.log("운영 API·배포 설정 일치 확인 완료. 실제 API/CORS·화면·장비 검증은 별도 필요합니다.");
