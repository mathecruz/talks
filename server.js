#!/usr/bin/env node
"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const PORT = Number(process.env.PORT) || 3000;
const LIVE_RELOAD = process.env.LIVE_RELOAD === "1";

const RELOAD_SNIPPET = `<script>new EventSource("/__livereload").onmessage=()=>location.reload();</script>`;
const clients = new Set();

function watchForChanges() {
	let timer;
	fs.watch(ROOT, { recursive: true }, (_event, filename) => {
		if (!filename || filename.includes("node_modules") || filename.startsWith(".git")) return;
		clearTimeout(timer);
		timer = setTimeout(() => {
			for (const client of clients) client.write("data: reload\n\n");
		}, 50);
	});
}

const MIME_TYPES = {
	".html": "text/html; charset=utf-8",
	".css": "text/css; charset=utf-8",
	".js": "text/javascript; charset=utf-8",
	".json": "application/json; charset=utf-8",
	".png": "image/png",
	".jpg": "image/jpeg",
	".jpeg": "image/jpeg",
	".gif": "image/gif",
	".svg": "image/svg+xml",
	".ico": "image/x-icon",
	".webp": "image/webp",
	".woff": "font/woff",
	".woff2": "font/woff2",
	".ttf": "font/ttf",
	".mp4": "video/mp4",
	".pdf": "application/pdf",
	".md": "text/markdown; charset=utf-8",
};

function resolveSafePath(urlPath) {
	const decoded = decodeURIComponent(urlPath.split("?")[0]);
	const resolved = path.normalize(path.join(ROOT, decoded));
	if (!resolved.startsWith(ROOT)) return null;
	return resolved;
}

const server = http.createServer((req, res) => {
	if (LIVE_RELOAD && req.url === "/__livereload") {
		res.writeHead(200, {
			"Content-Type": "text/event-stream",
			"Cache-Control": "no-cache",
			Connection: "keep-alive",
		});
		res.write("\n");
		clients.add(res);
		req.on("close", () => clients.delete(res));
		return;
	}

	let filePath = resolveSafePath(req.url);
	if (!filePath) {
		res.writeHead(400);
		res.end("Bad request");
		return;
	}

	fs.stat(filePath, (err, stats) => {
		if (!err && stats.isDirectory()) {
			filePath = path.join(filePath, "index.html");
		}

		fs.readFile(filePath, (readErr, content) => {
			if (readErr) {
				res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
				res.end("404 - Not found");
				return;
			}

			const ext = path.extname(filePath).toLowerCase();
			res.writeHead(200, { "Content-Type": MIME_TYPES[ext] || "application/octet-stream" });
			if (LIVE_RELOAD && ext === ".html") {
				res.end(content + RELOAD_SNIPPET);
				return;
			}
			res.end(content);
		});
	});
});

server.listen(PORT, () => {
	console.log(`Serving ${ROOT} at http://localhost:${PORT}`);
	if (LIVE_RELOAD) {
		watchForChanges();
		console.log("Live reload enabled");
	}
});
