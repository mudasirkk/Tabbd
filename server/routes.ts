import type { Express } from "express";
import { createServer, type Server } from "http";
import { sessionsRouter } from "./sessions/route";
import { stationsRouter } from "./stations/route";
import { customersRouter } from "./customers/route";
import { settingsRouter } from "./settings/route";
import { menuRouter } from "./menu/route";
import { cloverRouter } from "./clover/route";

export async function registerRoutes(app: Express): Promise<Server> {
  app.use(sessionsRouter);
  app.use(stationsRouter);
  app.use(customersRouter);
  app.use(settingsRouter);
  app.use(menuRouter);
  app.use(cloverRouter);

  return createServer(app);
}
