import express from "express";
import lighthouse, { Flags } from "lighthouse";
import chromeLauncher from "chrome-launcher";
import fs from "fs";
import path from "path";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);

const __dirname = path.dirname(__filename);

const app = express();
const port = 3000;

// Set various HTTP headers to help protect your app.
app.use(helmet());

// Limit repeated requests to public APIs and/or endpoints.
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
});
app.use("/url", limiter);

app.get("/url", async (req, res) => {
  let targetUrl = req.query.url as string;

  if (!targetUrl) {
    res.status(400).send("URL parameter is required");
    return;
  }

  // Simple validation and sanitization of URL
  try {
    const url = new URL(targetUrl);
    targetUrl = url.toString();
  } catch (error) {
    res.status(400).send("Invalid URL");
    return;
  }

  try {
    const chrome = await chromeLauncher.launch({ chromeFlags: ["--headless"] });
    const flags: Flags = {
      port: chrome.port,
      logLevel: "info",
      output: "html",
    };

    const runnerResult = await lighthouse(targetUrl, flags);

    if (runnerResult) {
      const reportHtml = runnerResult.report;
      const reportPath = path.join(__dirname, `report_${Date.now()}.html`);
      fs.writeFileSync(reportPath, reportHtml as string);

      const lhr = runnerResult.lhr;
      const categories = lhr.categories;

      res.json({
        reportPath,
        categories,
      });
    }

    await chrome.kill();
  } catch (error) {
    console.error(error);
    res.status(500).send("An error occurred while generating the report");
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
