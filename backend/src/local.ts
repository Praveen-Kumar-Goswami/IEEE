import { createServer } from "node:http";
import { requestIdFrom } from "./app.js";
import { loadDotEnv, readConfig } from "./config.js";
import type { HttpRequest } from "./http.js";
import { createRuntime } from "./runtime.js";

loadDotEnv();
const config = readConfig(process.env);
const handle = createRuntime(process.env);

const server = createServer(async (incoming, outgoing) => {
  const chunks: Buffer[] = [];
  for await (const chunk of incoming) chunks.push(Buffer.from(chunk));
  const bodyText = chunks.length > 0 ? Buffer.concat(chunks).toString("utf8") : null;
  const url = new URL(incoming.url ?? "/", "http://127.0.0.1");
  const headers: Record<string, string> = {};
  for (const [key, value] of Object.entries(incoming.headers)) {
    if (typeof value === "string") headers[key.toLowerCase()] = value;
  }
  const query: Record<string, string | undefined> = {};
  for (const [key, value] of url.searchParams.entries()) query[key] = value;
  const path = url.pathname.length > 1 && url.pathname.endsWith("/") ? url.pathname.slice(0, -1) : url.pathname;
  const request: HttpRequest = {
    method: (incoming.method ?? "GET").toUpperCase(),
    path,
    headers,
    query,
    bodyText,
    requestId: requestIdFrom(headers["x-request-id"]),
  };
  const response = await handle(request);
  outgoing.writeHead(response.status, response.headers);
  outgoing.end(response.body == null ? "" : JSON.stringify(response.body));
});

server.listen(config.port, "0.0.0.0", () => {
  console.log(JSON.stringify({ event: "listening", url: `http://127.0.0.1:${config.port}` }));
});
