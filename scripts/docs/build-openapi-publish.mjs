import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { parse, stringify } from 'yaml';

const projectRoot = process.cwd();
const openapiSourceDir = path.join(projectRoot, 'docs', 'openapi');
const openapiEntryFile = path.join(openapiSourceDir, 'openapi.yaml');
const apiGuideFile = path.join(openapiSourceDir, 'api-guide.md');
const publishDir = path.join(projectRoot, 'docs-publish');
const publishYamlFile = path.join(publishDir, 'openapi.yaml');
const publishJsonFile = path.join(publishDir, 'openapi.json');
const publishHtmlFile = path.join(publishDir, 'index.html');
const publishGuideFile = path.join(publishDir, 'api-guide.md');
const noJekyllFile = path.join(publishDir, '.nojekyll');

function ensureFileExists(filePath) {
  if (!existsSync(filePath)) {
    throw new Error(`文件不存在: ${path.relative(projectRoot, filePath)}`);
  }
}

function collectYamlFiles(rootDir) {
  const files = [];

  function walk(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        walk(fullPath);
        continue;
      }

      if (entry.isFile() && /\.ya?ml$/i.test(entry.name)) {
        files.push(fullPath);
      }
    }
  }

  walk(rootDir);

  return files;
}

const yamlCache = new Map();

function loadYamlFile(filePath) {
  const resolvedPath = path.resolve(filePath);

  if (!yamlCache.has(resolvedPath)) {
    yamlCache.set(resolvedPath, parse(readFileSync(resolvedPath, 'utf8')));
  }

  return yamlCache.get(resolvedPath);
}

function decodePointerToken(token) {
  return token.replace(/~1/g, '/').replace(/~0/g, '~');
}

function resolvePointer(document, pointer, filePath) {
  if (!pointer || pointer === '#') {
    return document;
  }

  if (!pointer.startsWith('#/')) {
    throw new Error(`不支持的 JSON Pointer: ${pointer} (${path.relative(projectRoot, filePath)})`);
  }

  let current = document;

  for (const rawToken of pointer.slice(2).split('/')) {
    const token = decodePointerToken(rawToken);

    if (current === null || current === undefined || !(token in current)) {
      throw new Error(
        `JSON Pointer 无法解析: ${pointer} (${path.relative(projectRoot, filePath)})`,
      );
    }

    current = current[token];
  }

  return current;
}

function validateRefs(node, currentFile) {
  if (Array.isArray(node)) {
    node.forEach((item) => validateRefs(item, currentFile));
    return;
  }

  if (!node || typeof node !== 'object') {
    return;
  }

  if (typeof node.$ref === 'string') {
    const [targetPath, rawPointer = ''] = node.$ref.split('#');
    const referenceFile = targetPath
      ? path.resolve(path.dirname(currentFile), targetPath)
      : currentFile;

    ensureFileExists(referenceFile);
    const referenceDoc = loadYamlFile(referenceFile);
    resolvePointer(referenceDoc, rawPointer ? `#${rawPointer}` : '#', referenceFile);
  }

  Object.values(node).forEach((value) => validateRefs(value, currentFile));
}

function dereferenceNode(node, currentFile, stack = new Set()) {
  if (Array.isArray(node)) {
    return node.map((item) => dereferenceNode(item, currentFile, stack));
  }

  if (!node || typeof node !== 'object') {
    return node;
  }

  if (typeof node.$ref === 'string') {
    const [targetPath, rawPointer = ''] = node.$ref.split('#');
    const referenceFile = targetPath
      ? path.resolve(path.dirname(currentFile), targetPath)
      : currentFile;
    const pointer = rawPointer ? `#${rawPointer}` : '#';
    const stackKey = `${referenceFile}::${pointer}`;

    if (stack.has(stackKey)) {
      throw new Error(`检测到循环引用: ${stackKey}`);
    }

    const nextStack = new Set(stack);
    nextStack.add(stackKey);

    const referenceDoc = loadYamlFile(referenceFile);
    const resolvedNode = resolvePointer(referenceDoc, pointer, referenceFile);

    return dereferenceNode(resolvedNode, referenceFile, nextStack);
  }

  const result = {};

  for (const [key, value] of Object.entries(node)) {
    result[key] = dereferenceNode(value, currentFile, stack);
  }

  return result;
}

function createHtml() {
  return `<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>w-server 接口文档</title>
    <style>
      :root {
        color-scheme: light;
        --bg: #f5f7fb;
        --panel: rgba(255, 255, 255, 0.96);
        --text: #132033;
        --muted: #516173;
        --line: rgba(19, 32, 51, 0.1);
        --accent: #0f766e;
        --accent-2: #155eef;
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        font-family: "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
        color: var(--text);
        background:
          radial-gradient(circle at top left, rgba(21, 94, 239, 0.12), transparent 28%),
          radial-gradient(circle at top right, rgba(15, 118, 110, 0.16), transparent 24%),
          linear-gradient(180deg, #f8fbff 0%, var(--bg) 100%);
      }

      .hero {
        position: sticky;
        top: 0;
        z-index: 10;
        backdrop-filter: blur(18px);
        background: rgba(245, 247, 251, 0.88);
        border-bottom: 1px solid var(--line);
      }

      .hero-inner {
        max-width: 1200px;
        margin: 0 auto;
        padding: 20px 24px;
        display: flex;
        flex-wrap: wrap;
        gap: 16px;
        align-items: center;
        justify-content: space-between;
      }

      .title {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }

      .title h1 {
        margin: 0;
        font-size: clamp(24px, 3vw, 34px);
        line-height: 1.1;
      }

      .title p {
        margin: 0;
        color: var(--muted);
        font-size: 14px;
      }

      .links {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
      }

      .links a {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 10px 14px;
        border-radius: 999px;
        border: 1px solid var(--line);
        background: var(--panel);
        color: var(--text);
        text-decoration: none;
        font-size: 14px;
        transition: transform 160ms ease, border-color 160ms ease;
      }

      .links a.primary {
        border-color: transparent;
        background: linear-gradient(135deg, var(--accent-2), var(--accent));
        color: #fff;
      }

      .links a:hover {
        transform: translateY(-1px);
      }

      main {
        max-width: 1200px;
        margin: 0 auto;
        padding: 18px 24px 48px;
      }

      .panel {
        border: 1px solid var(--line);
        border-radius: 24px;
        overflow: hidden;
        background: var(--panel);
        box-shadow: 0 18px 60px rgba(19, 32, 51, 0.08);
      }

      @media (max-width: 640px) {
        .hero-inner,
        main {
          padding-left: 16px;
          padding-right: 16px;
        }

        .links {
          width: 100%;
        }

        .links a {
          flex: 1 1 auto;
        }
      }
    </style>
  </head>
  <body>
    <header class="hero">
      <div class="hero-inner">
        <div class="title">
          <h1>w-server 接口文档</h1>
          <p>公开文档入口，包含可阅读页面、OpenAPI 单文件与 AI 使用说明。</p>
        </div>
        <nav class="links">
          <a class="primary" href="./openapi.yaml" target="_blank" rel="noreferrer">OpenAPI YAML</a>
          <a href="./openapi.json" target="_blank" rel="noreferrer">OpenAPI JSON</a>
          <a href="./api-guide.md" target="_blank" rel="noreferrer">接口说明</a>
        </nav>
      </div>
    </header>
    <main>
      <section class="panel">
        <redoc spec-url="./openapi.yaml"></redoc>
      </section>
    </main>
    <script src="https://cdn.redoc.ly/redoc/latest/bundles/redoc.standalone.js"></script>
  </body>
</html>
`;
}

function main() {
  ensureFileExists(openapiEntryFile);
  ensureFileExists(apiGuideFile);

  const yamlFiles = collectYamlFiles(openapiSourceDir);

  yamlFiles.forEach((file) => {
    loadYamlFile(file);
  });

  yamlFiles.forEach((file) => {
    validateRefs(loadYamlFile(file), file);
  });

  const bundledDocument = dereferenceNode(loadYamlFile(openapiEntryFile), openapiEntryFile);

  rmSync(publishDir, { recursive: true, force: true });
  mkdirSync(publishDir, { recursive: true });

  writeFileSync(publishYamlFile, stringify(bundledDocument, { lineWidth: 0 }), 'utf8');
  writeFileSync(publishJsonFile, `${JSON.stringify(bundledDocument, null, 2)}\n`, 'utf8');
  writeFileSync(publishHtmlFile, createHtml(), 'utf8');
  cpSync(apiGuideFile, publishGuideFile);
  writeFileSync(noJekyllFile, '', 'utf8');

  console.log('OpenAPI 发布产物已生成:');
  console.log(`- ${path.relative(projectRoot, publishYamlFile)}`);
  console.log(`- ${path.relative(projectRoot, publishJsonFile)}`);
  console.log(`- ${path.relative(projectRoot, publishHtmlFile)}`);
  console.log(`- ${path.relative(projectRoot, publishGuideFile)}`);
  console.log(`- ${path.relative(projectRoot, noJekyllFile)}`);
}

main();
