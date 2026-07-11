export default {
  async fetch(request, env) {
    const response = await env.ASSETS.fetch(request);
    const ct = response.headers.get("content-type") || "";
    if (ct.includes("text/html")) {
      const headers = new Headers(response.headers);
      headers.set("Cache-Control", "no-cache, no-store, must-revalidate");
      return new Response(response.body, { status: response.status, headers });
    }
    return response;
  }
};
