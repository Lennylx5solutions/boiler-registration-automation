// Boiler Registration Automation demo server.
// Serves the demo dashboard and reads boiler serial plates with Claude vision.
// Without an ANTHROPIC_API_KEY it falls back to recorded results, so anyone can run it.
const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PUBLIC = path.join(__dirname, "public");
const SAMPLES = ["serial-1", "serial-2", "serial-3"];
const recorded = require("./sample-results.json");

const SYSTEM = `You read serial numbers from photos of boiler data plates for a warranty-registration system.
Reply with JSON only: {"serial": "...", "model": "...", "readable": true|false, "confidence": "high"|"medium"|"low", "issue": "..."}.
If any character of the serial is blurred, hidden by glare or uncertain, set "readable" to false, use "?" for unclear characters and explain in "issue". Never guess a character you can't see.`;

async function readSerial(sample) {
  if (!process.env.ANTHROPIC_API_KEY) return recorded[sample];
  const Anthropic = require("@anthropic-ai/sdk");
  const data = fs.readFileSync(path.join(PUBLIC, sample + ".jpg")).toString("base64");
  const msg = await new Anthropic().messages.create({
    model: "claude-opus-5-5",
    max_tokens: 1000,
    system: SYSTEM,
    messages: [{ role: "user", content: [
      { type: "image", source: { type: "base64", media_type: "image/jpeg", data } },
      { type: "text", text: "Read the serial number on this data plate." },
    ] }],
  });
  const text = msg.content.filter((b) => b.type === "text").map((b) => b.text).join("");
  return JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
}

app.use(express.static(PUBLIC));
app.post("/api/boiler-demo/read/:sample", async (req, res) => {
  if (!SAMPLES.includes(req.params.sample)) return res.status(404).json({ error: "Unknown sample" });
  try {
    res.json(await readSerial(req.params.sample));
  } catch (err) {
    res.status(502).json({ error: "Couldn't read the photo" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Demo running at http://localhost:${PORT}`));
