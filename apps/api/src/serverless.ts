import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ExpressAdapter, type NestExpressApplication } from "@nestjs/platform-express";
import express, { type Express } from "express";
import type { IncomingMessage, ServerResponse } from "node:http";
import { configureApp } from "./app-setup";
import { AppModule } from "./app.module";

/**
 * Vercel function entry (see /api/index.js). The Nest app is created once per
 * function instance and reused by the following invocations (warm starts).
 */
let server: Promise<Express> | undefined;

async function createServer(): Promise<Express> {
  const instance = express();
  const app = await NestFactory.create<NestExpressApplication>(AppModule, new ExpressAdapter(instance), {
    logger: ["error", "warn"],
  });
  configureApp(app);
  await app.init();
  return instance;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  server ??= createServer().catch((error) => {
    server = undefined; // retry on next invocation instead of caching a failed boot
    throw error;
  });
  const app = await server;
  app(req as express.Request, res as express.Response);
}
