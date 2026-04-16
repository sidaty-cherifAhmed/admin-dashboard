const express = require('express');
const path = require('path');

const app = express();
const distPath = path.join(__dirname, 'dist/admin-dashboard/browser');
const apiTarget = new URL(
  process.env.API_TARGET || 'https://nonfervently-unlexicographical-amy.ngrok-free.dev/api/',
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api', async (req, res) => {
  try {
    const targetPath = req.originalUrl.replace(/^\/api\/?/, '');
    const targetUrl = new URL(targetPath, apiTarget);
    const forwardHeaders = new Headers();

    for (const [key, value] of Object.entries(req.headers)) {
      if (!value || ['host', 'content-length'].includes(key)) {
        continue;
      }

      if (Array.isArray(value)) {
        for (const item of value) {
          forwardHeaders.append(key, item);
        }
      } else {
        forwardHeaders.set(key, value);
      }
    }

    forwardHeaders.set('ngrok-skip-browser-warning', 'true');

    const canHaveBody = !['GET', 'HEAD'].includes(req.method);
    const requestBody =
      canHaveBody && req.body && Object.keys(req.body).length > 0
        ? JSON.stringify(req.body)
        : undefined;

    if (requestBody && !forwardHeaders.has('content-type')) {
      forwardHeaders.set('content-type', 'application/json');
    }

    const response = await fetch(targetUrl, {
      method: req.method,
      headers: forwardHeaders,
      body: requestBody,
    });

    res.status(response.status);

    response.headers.forEach((value, key) => {
      if (!['content-encoding', 'transfer-encoding', 'connection'].includes(key)) {
        res.setHeader(key, value);
      }
    });

    const responseBuffer = Buffer.from(await response.arrayBuffer());
    res.send(responseBuffer);
  } catch (error) {
    console.error('API proxy error:', error);
    res.status(502).json({ message: 'Failed to reach API upstream.' });
  }
});

app.use(express.static(distPath));

app.get(/^\/(?!api).*/, (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
