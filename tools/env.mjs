// 테스트 도구 공통 경로: 저장소 위치, Playwright, 크롬 실행 파일
// 다른 환경에서는 환경 변수로 바꾼다: PW_MODULES(playwright가 깔린 node_modules), CHROME_PATH(크롬 실행 파일)
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const loadModule = createRequire(process.env.PW_MODULES ? path.join(process.env.PW_MODULES, '/') : path.join(ROOT, 'node_modules/'));
export const CHROME = process.env.CHROME_PATH || undefined;
import fs from 'fs';
fs.mkdirSync(path.join(ROOT, 'shots'), { recursive: true });
