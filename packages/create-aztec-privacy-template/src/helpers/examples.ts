import { spawn } from 'node:child_process';
import { cp, mkdtemp, mkdir, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';

const DEFAULT_RETRY_ATTEMPTS = 3;
const DEFAULT_RETRY_DELAY_MS = 400;
const GITHUB_HOSTS = new Set(['github.com', 'www.github.com']);
const GITHUB_TOKEN_PATTERN = /^[A-Za-z0-9._-]+$/;

export interface ParsedGithubExampleSource {
  owner: string;
  repo: string;
  ref: string;
  subPath: string;
  normalizedSource: string;
}

export interface InstallExampleSourceOptions {
  absoluteTargetPath: string;
  exampleSource: string;
  maxAttempts?: number;
  retryDelayMs?: number;
}

export interface InstallExampleSourceResult {
  source: string;
  applied: boolean;
  attempts: number;
  fallbackReason?: string;
}

interface ExampleSourceDependencies {
  fetchImpl: typeof fetch;
  extractArchive: (archivePath: string, extractDir: string) => Promise<void>;
  sleep: (delayMs: number) => Promise<void>;
}

const defaultDependencies: ExampleSourceDependencies = {
  fetchImpl: fetch,
  extractArchive: extractTarArchive,
  sleep: wait,
};

export async function installExampleSource(
  options: InstallExampleSourceOptions,
  dependencies: ExampleSourceDependencies = defaultDependencies,
): Promise<InstallExampleSourceResult> {
  const parsedSource = parseGithubExampleSource(options.exampleSource);
  const maxAttempts = normalizeRetryAttempts(options.maxAttempts);
  const retryDelayMs = normalizeRetryDelay(options.retryDelayMs);
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await downloadAndApplyExampleSource({
        absoluteTargetPath: options.absoluteTargetPath,
        parsedSource,
        dependencies,
      });

      return {
        source: parsedSource.normalizedSource,
        applied: true,
        attempts: attempt,
      };
    } catch (error) {
      lastError = error;

      if (attempt < maxAttempts) {
        await dependencies.sleep(retryDelayMs * attempt);
      }
    }
  }

  return {
    source: parsedSource.normalizedSource,
    applied: false,
    attempts: maxAttempts,
    fallbackReason: formatErrorMessage(lastError),
  };
}

export function parseGithubExampleSource(source: string): ParsedGithubExampleSource {
  const trimmed = source.trim();
  if (!trimmed) {
    throw new Error('Example source cannot be empty.');
  }

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return parseGithubUrlSource(trimmed);
  }

  return parseGithubRepoSource(trimmed);
}

async function downloadAndApplyExampleSource({
  absoluteTargetPath,
  parsedSource,
  dependencies,
}: {
  absoluteTargetPath: string;
  parsedSource: ParsedGithubExampleSource;
  dependencies: ExampleSourceDependencies;
}): Promise<void> {
  const tempRoot = await mkdtemp(join(tmpdir(), 'capt-example-source-'));
  const archivePath = join(tempRoot, 'source.tar.gz');
  const extractDir = join(tempRoot, 'extract');

  try {
    await mkdir(extractDir, { recursive: true });
    await downloadArchive(parsedSource, archivePath, dependencies.fetchImpl);
    await dependencies.extractArchive(archivePath, extractDir);

    const extractedRoot = await findExtractedRoot(extractDir);
    const sourcePath = resolveSourcePath(extractedRoot, parsedSource.subPath);

    const sourceStats = await stat(sourcePath);
    if (!sourceStats.isDirectory()) {
      throw new Error(`Remote source path is not a directory: ${parsedSource.subPath || '.'}`);
    }

    await cp(sourcePath, absoluteTargetPath, {
      recursive: true,
      errorOnExist: false,
      force: true,
      preserveTimestamps: true,
    });
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}

async function downloadArchive(
  parsedSource: ParsedGithubExampleSource,
  archivePath: string,
  fetchImpl: typeof fetch,
): Promise<void> {
  const archiveUrl = buildArchiveUrl(parsedSource);
  const response = await fetchImpl(archiveUrl, {
    redirect: 'follow',
    headers: {
      'user-agent': 'create-aztec-privacy-template',
    },
  });

  if (!response.ok) {
    throw new Error(`GitHub archive request failed (${response.status} ${response.statusText}).`);
  }

  const archiveBuffer = Buffer.from(await response.arrayBuffer());
  await writeFile(archivePath, archiveBuffer);
}

function buildArchiveUrl(parsedSource: ParsedGithubExampleSource): string {
  const { owner, repo, ref } = parsedSource;
  return `https://codeload.github.com/${owner}/${repo}/tar.gz/${encodeURIComponent(ref)}`;
}

async function extractTarArchive(archivePath: string, extractDir: string): Promise<void> {
  await new Promise<void>((resolvePromise, reject) => {
    const child = spawn('tar', ['-xzf', archivePath, '-C', extractDir], {
      stdio: 'ignore',
    });

    child.on('error', (error) => {
      reject(new Error(`Failed to extract remote archive: ${error.message}`));
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolvePromise();
        return;
      }

      reject(
        new Error(`Failed to extract remote archive (tar exited with code ${code ?? 'unknown'}).`),
      );
    });
  });
}

async function findExtractedRoot(extractDir: string): Promise<string> {
  const entries = await readdir(extractDir, { withFileTypes: true });
  const rootEntry = entries.find((entry) => entry.isDirectory());

  if (!rootEntry) {
    throw new Error('Remote archive extraction produced no files.');
  }

  return join(extractDir, rootEntry.name);
}

function resolveSourcePath(extractedRoot: string, subPath: string): string {
  if (!subPath) {
    return extractedRoot;
  }

  const candidate = resolve(extractedRoot, subPath);
  if (candidate === extractedRoot || candidate.startsWith(`${extractedRoot}${sep}`)) {
    return candidate;
  }

  throw new Error('Remote source path escapes extracted archive.');
}

function parseGithubUrlSource(rawSource: string): ParsedGithubExampleSource {
  if (rawSource.trim().endsWith('#')) {
    throw new Error('GitHub source ref cannot be empty after "#".');
  }

  const url = new URL(rawSource);
  if (!GITHUB_HOSTS.has(url.hostname)) {
    throw new Error('Example source URL must point to github.com.');
  }

  const segments = url.pathname
    .split('/')
    .filter(Boolean)
    .map((segment) => decodeURIComponent(segment));

  if (segments.length < 2) {
    throw new Error('GitHub example URL must include owner and repository.');
  }

  const owner = validateGitHubToken(segments[0], 'owner');
  const repo = validateGitHubToken(stripGitSuffix(segments[1]), 'repository');
  const refFromHash = parseUrlHashRef(url);
  let ref = refFromHash ?? 'HEAD';
  let subPath = '';

  if (segments[2] === 'tree') {
    if (!segments[3]) {
      throw new Error('GitHub tree URL must include a branch or tag.');
    }

    ref = refFromHash ?? segments[3];
    subPath = segments.slice(4).join('/');
  } else if (segments.length > 2) {
    subPath = segments.slice(2).join('/');
  }

  return toParsedGithubSource(owner, repo, ref, subPath);
}

function parseGithubRepoSource(rawSource: string): ParsedGithubExampleSource {
  const hashIndex = rawSource.indexOf('#');
  let mainPart = rawSource;
  let refFromHash: string | undefined;

  if (hashIndex !== -1) {
    mainPart = rawSource.slice(0, hashIndex);
    refFromHash = rawSource.slice(hashIndex + 1).trim();

    if (!refFromHash) {
      throw new Error('GitHub source ref cannot be empty after "#".');
    }
  }

  const segments = mainPart
    .split('/')
    .filter(Boolean)
    .map((segment) => decodeURIComponent(segment));

  if (segments.length < 2) {
    throw new Error('GitHub repo source must use "<owner>/<repo>" format.');
  }

  const owner = validateGitHubToken(segments[0], 'owner');
  const repo = validateGitHubToken(stripGitSuffix(segments[1]), 'repository');
  let ref = refFromHash ?? 'HEAD';
  let subPath = '';

  if (segments[2] === 'tree') {
    if (!segments[3]) {
      throw new Error('GitHub tree source must include a branch or tag.');
    }

    ref = refFromHash ?? segments[3];
    subPath = segments.slice(4).join('/');
  } else if (segments.length > 2) {
    subPath = segments.slice(2).join('/');
  }

  return toParsedGithubSource(owner, repo, ref, subPath);
}

function validateGitHubToken(value: string, label: string): string {
  if (GITHUB_TOKEN_PATTERN.test(value)) {
    return value;
  }

  throw new Error(`Invalid GitHub ${label} in example source: "${value}".`);
}

function stripGitSuffix(repo: string): string {
  return repo.endsWith('.git') ? repo.slice(0, -4) : repo;
}

function parseUrlHashRef(url: URL): string | undefined {
  if (!url.hash) {
    return undefined;
  }

  const rawRef = url.hash.slice(1).trim();
  if (!rawRef) {
    throw new Error('GitHub source ref cannot be empty after "#".');
  }

  try {
    return decodeURIComponent(rawRef);
  } catch {
    throw new Error('GitHub source ref is not valid URL encoding.');
  }
}

function toParsedGithubSource(
  owner: string,
  repo: string,
  ref: string,
  subPath: string,
): ParsedGithubExampleSource {
  const normalizedRef = ref.trim() || 'HEAD';
  const normalizedSubPath = subPath.replace(/^\/+|\/+$/g, '');
  const suffix = normalizedSubPath ? `/${normalizedSubPath}` : '';

  return {
    owner,
    repo,
    ref: normalizedRef,
    subPath: normalizedSubPath,
    normalizedSource: `https://github.com/${owner}/${repo}/tree/${normalizedRef}${suffix}`,
  };
}

function normalizeRetryAttempts(value: number | undefined): number {
  if (value === undefined) {
    return DEFAULT_RETRY_ATTEMPTS;
  }

  if (!Number.isInteger(value) || value < 1) {
    throw new Error('maxAttempts must be a positive integer.');
  }

  return value;
}

function normalizeRetryDelay(value: number | undefined): number {
  if (value === undefined) {
    return DEFAULT_RETRY_DELAY_MS;
  }

  if (!Number.isFinite(value) || value < 0) {
    throw new Error('retryDelayMs must be a non-negative number.');
  }

  return value;
}

function formatErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

async function wait(delayMs: number): Promise<void> {
  await new Promise((resolvePromise) => {
    setTimeout(resolvePromise, delayMs);
  });
}
