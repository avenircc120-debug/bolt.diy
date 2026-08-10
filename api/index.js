import { createRequestHandler } from '@remix-run/node';
import * as build from '../build/server/index.js';

const handler = createRequestHandler(build, process.env.NODE_ENV);

export default async function (req, res) {
  // Reconstruct a Fetch API Request from the Vercel Node.js req object
  const url = `https://${req.headers.host}${req.url}`;

  const controller = new AbortController();
  req.on('close', () => controller.abort());

  const request = new Request(url, {
    method: req.method,
    headers: req.headers,
    body: ['GET', 'HEAD'].includes(req.method) ? undefined : req,
    signal: controller.signal,
    duplex: 'half',
  });

  // This context object mimics the shape the app expects from Cloudflare,
  // so none of the existing route files (which read context.cloudflare?.env)
  // need to be modified.
  const loadContext = {
    cloudflare: {
      env: process.env,
    },
  };

  const response = await handler(request, loadContext);

  res.statusCode = response.status;
  response.headers.forEach((value, key) => {
    res.setHeader(key, value);
  });

  if (response.body) {
    const reader = response.body.getReader();

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      res.write(value);
    }
  }

  res.end();
}
