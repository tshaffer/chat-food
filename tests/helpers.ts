import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Readable, Writable } from "node:stream";
import { createApp } from "../server/index.js";
import type { Database } from "../shared/types.js";

interface TestRequestInput {
  method: string;
  url: string;
  body?: unknown;
  headers?: Record<string, string>;
}

interface TestResponse {
  status: number;
  headers: Record<string, string>;
  json: unknown;
  text: string;
}

export async function createTempDatabase(database: Database) {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "food-tracker-tests-"));
  const dbPath = path.join(tempDir, "db.json");
  await writeFile(dbPath, `${JSON.stringify(database, null, 2)}\n`, "utf-8");
  return { tempDir, dbPath };
}

export async function readTempDatabase(dbPath: string): Promise<Database> {
  return JSON.parse(await readFile(dbPath, "utf-8")) as Database;
}

async function performRequest(app: ReturnType<typeof createApp>, input: TestRequestInput): Promise<TestResponse> {
  const payload = input.body === undefined ? "" : JSON.stringify(input.body);
  const requestHeaders = {
    ...input.headers,
  };

  if (payload && !requestHeaders["content-type"]) {
    requestHeaders["content-type"] = "application/json";
  }
  if (payload) {
    requestHeaders["content-length"] = String(Buffer.byteLength(payload));
  }

  const request = Readable.from(payload ? [payload] : []);
  Object.assign(request, {
    method: input.method,
    url: input.url,
    headers: requestHeaders,
    socket: { remoteAddress: "127.0.0.1" },
    connection: { remoteAddress: "127.0.0.1" },
  });

  const chunks: Buffer[] = [];
  const responseHeaders = new Map<string, string>();

  const response = new Writable({
    write(chunk, _encoding, callback) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      callback();
    },
  }) as Writable & {
    statusCode: number;
    locals: Record<string, unknown>;
    setHeader: (name: string, value: string | number | readonly string[]) => void;
    getHeader: (name: string) => string | undefined;
    getHeaders: () => Record<string, string>;
    removeHeader: (name: string) => void;
    writeHead: (statusCode: number, headers?: Record<string, string>) => typeof response;
    end: (chunk?: string | Buffer) => typeof response;
  };

  response.statusCode = 200;
  response.locals = {};
  response.setHeader = (name, value) => {
    responseHeaders.set(name.toLowerCase(), Array.isArray(value) ? value.join(", ") : String(value));
  };
  response.getHeader = (name) => responseHeaders.get(name.toLowerCase());
  response.getHeaders = () => Object.fromEntries(responseHeaders.entries());
  response.removeHeader = (name) => {
    responseHeaders.delete(name.toLowerCase());
  };
  response.writeHead = (statusCode, headers = {}) => {
    response.statusCode = statusCode;
    Object.entries(headers).forEach(([name, value]) => response.setHeader(name, value));
    return response;
  };

  let responseText = "";
  response.end = (chunk) => {
    if (chunk) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    responseText = Buffer.concat(chunks).toString("utf-8");
    response.emit("finish");
    return response;
  };

  await new Promise<void>((resolve, reject) => {
    response.on("finish", () => resolve());
    response.on("error", reject);
    app.handle(request as never, response as never, reject);
  });

  return {
    status: response.statusCode,
    headers: Object.fromEntries(responseHeaders.entries()),
    json: responseText ? JSON.parse(responseText) : null,
    text: responseText,
  };
}

export async function withTestServer<T>(
  dbPath: string,
  run: (request: (input: TestRequestInput) => Promise<TestResponse>) => Promise<T>,
) {
  const previousDbPath = process.env.FOOD_TRACKER_DB_PATH;
  process.env.FOOD_TRACKER_DB_PATH = dbPath;

  const app = createApp();

  try {
    return await run((input) => performRequest(app, input));
  } finally {
    if (previousDbPath) {
      process.env.FOOD_TRACKER_DB_PATH = previousDbPath;
    } else {
      delete process.env.FOOD_TRACKER_DB_PATH;
    }
  }
}

export async function cleanupTempDatabase(tempDir: string) {
  await rm(tempDir, { recursive: true, force: true });
}
