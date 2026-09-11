// Custom Next.js server — terminates HTTPS itself (Pattern B on this
// machine: standalone PM2 process with its own cert, same as
// Photo2Print/RiseUp), rather than sitting behind an IIS reverse proxy.
// Next.js's own production server (`next start`) only speaks plain HTTP;
// this wraps its request handler with Node's https module instead, using
// the household's one shared self-signed certificate — reused, not
// generated fresh (see the homelab-deploy skill).
import { createServer as createHttpsServer } from "node:https";
import { createServer as createHttpServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import next from "next";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT) || 37000;
const dev = process.env.NODE_ENV !== "production";

const app = next({ dev, dir: __dirname });
const handle = app.getRequestHandler();

const certPath = path.join(__dirname, "certs", "cert.pem");
const keyPath = path.join(__dirname, "certs", "key.pem");

app.prepare().then(() => {
  const requestHandler = (req, res) => handle(req, res);

  if (existsSync(certPath) && existsSync(keyPath)) {
    const options = { cert: readFileSync(certPath), key: readFileSync(keyPath) };
    createHttpsServer(options, requestHandler).listen(port, () => {
      console.log(`Insurance Advisor Platform listening on https://localhost:${port}`);
    });
  } else {
    console.warn("No cert/key found in apps/web/certs — falling back to plain HTTP (local dev only).");
    createHttpServer(requestHandler).listen(port, () => {
      console.log(`Insurance Advisor Platform listening on http://localhost:${port}`);
    });
  }
});
