import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import type { Context } from '@deepseek-ai/cordis';
import Schema from '@deepseek-ai/schemastery';

/**
 * Praxis vision enhancement — Host wraps the published dsh-vision-plugin
 * engine and exposes an on-page enable switch (settings → 视觉增强).
 */
export const name = 'workdsh-plugin-vision';
export const inject = ['fs', 'llm', 'attachments', 'tools'] as const;

export interface Config {
  /** Boot default for the on-page switch; runtime value is persisted separately. */
  readonly enabled: boolean;
}

export const Config: Schema<Config> = Schema.object({
  enabled: Schema.boolean().default(true).description('默认是否启用视觉增强（设置页开关可覆盖并持久化）'),
});

type VisionEngine = {
  VERSION: string;
  makeTool: (ctx: Context) => { name: string; description: string; parameters: unknown; execute: (...args: never[]) => unknown };
  makeWaterfallListener: (ctx: Context) => (options: unknown, next: () => AsyncGenerator) => AsyncGenerator;
  catalogState: (ctx: Context) => Promise<Record<string, unknown>>;
  setConfiguredRoute: (route: { provider: string; model: string } | null) => void;
  findProviderForModel: (ctx: Context, model: string, preferred: string | null) => Promise<string | null>;
};

type Preference = { enabled: boolean };

function preferenceFile(): string {
  const home = process.env.DSH_HOME ?? join(homedir(), '.dsh');
  return join(home, 'workdsh-vision-preference.json');
}

async function readPreference(fallback: boolean): Promise<Preference> {
  try {
    const raw = JSON.parse(await readFile(preferenceFile(), 'utf8')) as Preference;
    if (typeof raw?.enabled === 'boolean') return { enabled: raw.enabled };
  } catch { /* first run or corrupt */ }
  return { enabled: fallback };
}

async function writePreference(next: Preference): Promise<void> {
  const path = preferenceFile();
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
}

async function loadEngine(): Promise<VisionEngine> {
  const require = createRequire(import.meta.url);
  const root = dirname(require.resolve('dsh-vision-plugin/package.json'));
  return import(pathToFileURL(join(root, 'lib/engine.js')).href) as Promise<VisionEngine>;
}

function sendJson(res: { writeHead: (code: number, headers: Record<string, string>) => void; end: (body: string) => void }, status: number, value: unknown): void {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  res.end(JSON.stringify(value));
}

function readJsonBody(req: { on: (event: string, cb: (...args: never[]) => void) => void; destroy: () => void }, maxBytes = 65_536): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', ((chunk: Buffer) => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(new Error('request body too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    }) as (...args: never[]) => void);
    req.on('end', (() => {
      if (!chunks.length) {
        resolve({});
        return;
      }
      try {
        const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
        resolve(parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {});
      } catch (error) {
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    }) as (...args: never[]) => void);
    req.on('error', reject as (...args: never[]) => void);
  });
}

type HostCtx = Context & {
  tools: { register: (tool: unknown) => () => void };
  on: (event: string, listener: unknown) => () => void;
  inject: (deps: string[], callback: (scope: HostCtx) => void) => void;
  effect: (factory: () => () => void) => void;
};

export function apply(ctx: Context, config: Config): void {
  const host = ctx as HostCtx;
  const logger = ctx.logger('workdsh-vision');
  const preference: Preference = { enabled: config.enabled };
  let engine: VisionEngine | undefined;

  const ensureEngine = async () => {
    if (!engine) engine = await loadEngine();
    return engine;
  };

  void readPreference(config.enabled).then((stored) => {
    preference.enabled = stored.enabled;
    logger.info(`视觉增强偏好：enabled=${preference.enabled}`);
  }).catch((cause) => {
    logger.warn(`读取视觉增强偏好失败：${cause instanceof Error ? cause.message : String(cause)}`);
  });

  void ensureEngine().then((loaded) => {
    const tool = loaded.makeTool(ctx);
    host.effect(() => host.tools.register({
      ...tool,
      execute: async (...args: never[]) => {
        if (!preference.enabled) {
          throw new Error('视觉增强已关闭。请在设置 → 视觉增强中打开开关。');
        }
        return (tool.execute as (...a: never[]) => unknown)(...args);
      },
    }));

    const listener = loaded.makeWaterfallListener(ctx);
    host.on('llm/stream', async function* (options: unknown, next: () => AsyncGenerator) {
      if (!preference.enabled) return yield* next();
      return yield* listener(options, next);
    });

    logger.info(`视觉增强引擎 v${loaded.VERSION} 已挂载（设置页可开关）`);
  }).catch((cause) => {
    logger.error(`视觉增强引擎加载失败：${cause instanceof Error ? cause.message : String(cause)}`);
  });

  host.inject(['webServer'], (scope) => {
    const web = scope as HostCtx & {
      webServer: {
        register: (route: {
          kind: 'exact';
          path: string;
          handler: (req: { on: (event: string, cb: (...args: never[]) => void) => void; destroy: () => void }, res: { writeHead: (code: number, headers: Record<string, string>) => void; end: (body: string) => void }) => Promise<void>;
        }) => () => void;
      };
    };

    scope.effect(() => web.webServer.register({
      kind: 'exact',
      path: '/vision/api/state',
      handler: async (_req, res) => {
        try {
          const loaded = await ensureEngine();
          const state = await loaded.catalogState(scope);
          sendJson(res, 200, { ...state, enabled: preference.enabled, praxis: true });
        } catch (err) {
          sendJson(res, 500, { error: String((err as Error)?.message || err), enabled: preference.enabled });
        }
      },
    }));

    scope.effect(() => web.webServer.register({
      kind: 'exact',
      path: '/vision/api/model',
      handler: async (req, res) => {
        let args: Record<string, unknown>;
        try { args = await readJsonBody(req); }
        catch (err) { sendJson(res, 400, { error: String((err as Error)?.message || err) }); return; }
        try {
          const loaded = await ensureEngine();
          const model = args.model !== undefined && args.model !== null ? String(args.model) : null;
          if (model === null) {
            loaded.setConfiguredRoute(null);
          } else {
            const preferred = args.provider ? String(args.provider) : null;
            const provider = await loaded.findProviderForModel(scope, model, preferred);
            if (provider === null) throw new Error(`vision: "${model}" is not an image-capable model on any configured provider`);
            loaded.setConfiguredRoute({ provider, model });
          }
          const state = await loaded.catalogState(scope);
          sendJson(res, 200, { ...state, enabled: preference.enabled, praxis: true });
        } catch (err) {
          sendJson(res, 400, { error: String((err as Error)?.message || err) });
        }
      },
    }));

    scope.effect(() => web.webServer.register({
      kind: 'exact',
      path: '/vision/api/enabled',
      handler: async (req, res) => {
        try {
          const args = await readJsonBody(req).catch(() => ({} as Record<string, unknown>));
          if (typeof args.enabled === 'boolean') {
            preference.enabled = args.enabled;
            await writePreference({ enabled: preference.enabled });
            logger.info(`视觉增强开关 → ${preference.enabled ? '开' : '关'}`);
          }
          sendJson(res, 200, { enabled: preference.enabled });
        } catch (err) {
          sendJson(res, 400, { error: String((err as Error)?.message || err), enabled: preference.enabled });
        }
      },
    }));
  });
}
