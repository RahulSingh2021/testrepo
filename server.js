import { createServer } from "http";
import { parse } from "url";
import next from "next";

const port = parseInt(process.env.PORT || "5000", 10);
const hostname = "0.0.0.0";
const dev = false;

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

let isReady = false;
let startupError = null;

const server = createServer((req, res) => {
  if (startupError) {
    res.writeHead(500, { "Content-Type": "text/html" });
    res.end("<!DOCTYPE html><html><head><meta charset='utf-8'><title>HACCP PRO</title><meta http-equiv='refresh' content='10'></head><body style='display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:sans-serif;background:#f8fafc'><div style='text-align:center'><p style='color:#ef4444;font-size:16px;font-weight:bold'>Startup Error</p><p style='color:#64748b;margin-top:8px;font-size:13px'>Retrying...</p></div></body></html>");
    return;
  }
  if (!isReady) {
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end("<!DOCTYPE html><html><head><meta charset='utf-8'><title>HACCP PRO</title><meta http-equiv='refresh' content='3'></head><body style='display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:sans-serif;background:#f8fafc'><div style='text-align:center'><div style='width:40px;height:40px;border:4px solid #c7d2fe;border-top-color:#4f46e5;border-radius:50%;animation:spin 1s linear infinite;margin:0 auto'></div><p style='color:#64748b;margin-top:16px;font-size:14px'>Starting HACCP PRO...</p></div><style>@keyframes spin{to{transform:rotate(360deg)}}</style></body></html>");
    return;
  }
  const parsedUrl = parse(req.url, true);
  handle(req, res, parsedUrl);
});

server.listen(port, hostname, () => {
  console.log(`> Server listening on http://${hostname}:${port}`);
});

app.prepare().then(() => {
  isReady = true;
  console.log(`> Next.js ready`);
}).catch((err) => {
  startupError = err;
  console.error("> Next.js failed to start:", err);
});
