exports.handler = async (event) => {
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, headers: { "Content-Type": "text/plain" }, body: "Only GET requests are supported." };
  }

  const requestedUrl = event.queryStringParameters?.url;
  if (!requestedUrl) {
    return { statusCode: 400, headers: { "Content-Type": "text/plain" }, body: "Missing ?url=" };
  }

  let target;
  try { target = new URL(requestedUrl); }
  catch { return { statusCode: 400, headers: { "Content-Type": "text/plain" }, body: "Invalid URL." }; }

  if (!["http:", "https:"].includes(target.protocol)) {
    return { statusCode: 400, headers: { "Content-Type": "text/plain" }, body: "Only HTTP and HTTPS URLs are supported." };
  }

  // Set PROXY_ALLOWED_HOSTS in Netlify, e.g. "example.com,my-test-site.com".
  // This intentionally does not provide an open/unrestricted proxy.
  const rules = (process.env.PROXY_ALLOWED_HOSTS || "example.com")
    .split(",").map(x => x.trim().toLowerCase()).filter(Boolean);
  const hostname = target.hostname.toLowerCase();

  const isPrivateHost =
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "0.0.0.0" ||
    hostname === "::1" ||
    hostname.startsWith("10.") ||
    hostname.startsWith("192.168.") ||
    hostname.startsWith("172.16.") || hostname.startsWith("172.17.") ||
    hostname.startsWith("172.18.") || hostname.startsWith("172.19.") ||
    hostname.startsWith("172.20.") || hostname.startsWith("172.21.") ||
    hostname.startsWith("172.22.") || hostname.startsWith("172.23.") ||
    hostname.startsWith("172.24.") || hostname.startsWith("172.25.") ||
    hostname.startsWith("172.26.") || hostname.startsWith("172.27.") ||
    hostname.startsWith("172.28.") || hostname.startsWith("172.29.") ||
    hostname.startsWith("172.30.") || hostname.startsWith("172.31.") ||
    hostname.endsWith(".local") || hostname.endsWith(".internal");

  const allowed = rules.some(rule => hostname === rule || hostname.endsWith("." + rule));
  if (isPrivateHost || !allowed) {
    return { statusCode: 403, headers: { "Content-Type": "text/plain" }, body: "This domain is not enabled for this proxy." };
  }

  try {
    const response = await fetch(target.href, { redirect: "follow" });
    const headers = {};
    for (const [key, value] of response.headers.entries()) {
      const k = key.toLowerCase();
      if (!["content-length", "transfer-encoding", "connection"].includes(k)) headers[key] = value;
    }
    headers["Cache-Control"] = "no-store";

    const body = Buffer.from(await response.arrayBuffer()).toString("base64");
    return { statusCode: response.status, headers, isBase64Encoded: true, body };
  } catch (error) {
    return { statusCode: 502, headers: { "Content-Type": "text/plain" }, body: "The proxy could not reach the destination." };
  }
};
