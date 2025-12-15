import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import "dotenv/config";

console.log("BOOT: starting server");

// ---- ENV CHECKS (boolean only, no secrets) ----
console.log("ENV CHECK: NODE_ENV =", process.env.NODE_ENV);
console.log("ENV CHECK: PORT =", process.env.PORT);
console.log(
  "ENV CHECK: FIREBASE_SERVICE_ACCOUNT_B64 exists =",
  !!process.env.FIREBASE_SERVICE_ACCOUNT_B64
);
console.log(
  "ENV CHECK: SQUARE_APPLICATION_ID exists =",
  !!process.env.SQUARE_APPLICATION_ID
);
console.log(
  "ENV CHECK: SQUARE_APPLICATION_SECRET exists =",
  !!process.env.SQUARE_APPLICATION_SECRET
);
console.log(
  "ENV CHECK: DATABASE_URL exists =",
  !!process.env.DATABASE_URL
);
// ----------------------------------------------

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  console.log("BOOT: registering routes");
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error("UNHANDLED ERROR:", err);
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
    throw err;
  });

  if (app.get("env") === "development") {
    console.log("BOOT: setting up Vite dev server");
    await setupVite(app, server);
  } else {
    console.log("BOOT: serving static files");
    serveStatic(app);
  }

  const port = parseInt(process.env.PORT || "5000", 10);

  console.log("BOOT: starting HTTP server");

  server.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`[express] Server running on port ${port}`);
    }
  );
})();
