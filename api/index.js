import { createRequestHandler } from '@remix-run/node';
import * as build from '../build/server/index.js';

const handler = createRequestHandler(build, process.env.NODE_ENV);

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export default async function (req, res) {
  const url = `https://${req.headers.host}${req.url}`;
  const isBodyless = ['GET', 'HEAD'].includes(req.method);

  const body = isBodyless ? undefined : await readRequestBody(req);

  const request = new Request(url, {
    method: req.method,
    headers: req.headers,
    body,
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
    // Let Vercel/Node manage these automatically
    if (key.toLowerCase() === 'content-encoding' || key.toLowerCase() === 'content-length') {
      return;
    }

    res.setHeader(key, value);
  });
  res.flushHeaders?.();

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
