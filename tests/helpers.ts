import { randomUUID } from "node:crypto";
import { Readable, Writable } from "node:stream";
import { MongoMemoryServer } from "mongodb-memory-server";
import { createApp } from "../server/index.js";
import { disconnectDatabase, readDatabase, writeDatabase } from "../server/store.js";
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
  const mongoServer = await MongoMemoryServer.create({
    instance: {
      ip: "127.0.0.1",
      port: 37017 + Math.floor(Math.random() * 1000),
    },
  });
  const dbName = `food-tracker-test-${randomUUID()}`;

  const previousUri = process.env.MONGODB_URI;
  const previousDbName = process.env.MONGODB_DB_NAME;
  process.env.MONGODB_URI = mongoServer.getUri();
  process.env.MONGODB_DB_NAME = dbName;

  await writeDatabase(database);

  return {
    mongoServer,
    cleanup: async () => {
      await disconnectDatabase();
      await mongoServer.stop();

      if (previousUri) {
        process.env.MONGODB_URI = previousUri;
      } else {
        delete process.env.MONGODB_URI;
      }

      if (previousDbName) {
        process.env.MONGODB_DB_NAME = previousDbName;
      } else {
        delete process.env.MONGODB_DB_NAME;
      }
    },
  };
}

export async function readTempDatabase(): Promise<Database> {
  return readDatabase();
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
  run: (request: (input: TestRequestInput) => Promise<TestResponse>) => Promise<T>,
) {
  const app = createApp();
  return run((input) => performRequest(app, input));
}
