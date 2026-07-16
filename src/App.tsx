// Vercel serverless function — save this file as: api/claude.js  (repo root /api folder)
// Then in Vercel dashboard → Project → Settings → Environment Variables:
//   add ANTHROPIC_API_KEY = your key   (NO "REACT_APP_" prefix)
// Finally delete REACT_APP_ANTHROPIC_API_KEY from Vercel env vars and redeploy.

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  try {
    const upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(req.body),
    });
    const data = await upstream.json();
    res.status(upstream.status).json(data);
  } catch (err) {
    res.status(500).json({ error: "Proxy request failed" });
  }
}
