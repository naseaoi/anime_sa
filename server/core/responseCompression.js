import zlib from 'node:zlib';

const COMPRESSIBLE_TYPES = ['text/', 'javascript', 'json', 'xml', 'svg'];

const parseAcceptedEncodings = (value) => {
  const accepted = new Map();
  for (const item of String(value || '').toLowerCase().split(',')) {
    const [name, ...params] = item.trim().split(';');
    if (!name) continue;
    const qualityParam = params.find((param) => param.trim().startsWith('q='));
    const quality = qualityParam ? Number(qualityParam.trim().slice(2)) : 1;
    accepted.set(name, Number.isFinite(quality) ? quality : 0);
  }
  return accepted;
};

export const selectResponseEncoding = (value) => {
  const accepted = parseAcceptedEncodings(value);
  const wildcard = accepted.get('*') || 0;
  const brotli = accepted.has('br') ? accepted.get('br') : wildcard;
  const gzip = accepted.has('gzip') ? accepted.get('gzip') : wildcard;
  if ((brotli || 0) > 0 && (brotli || 0) >= (gzip || 0)) return 'br';
  if ((gzip || 0) > 0) return 'gzip';
  return null;
};

const appendVary = (response, value) => {
  const current = String(response.getHeader?.('Vary') || '');
  const values = new Set(current.split(',').map((item) => item.trim()).filter(Boolean));
  values.add(value);
  response.setHeader('Vary', [...values].join(', '));
};

const canCompressResponse = (request, response, chunk, threshold) => {
  if (request.method === 'HEAD' || response.statusCode === 204 || response.statusCode === 304) return false;
  if (response.getHeader?.('Content-Encoding')) return false;
  const cacheControl = String(response.getHeader?.('Cache-Control') || '').toLowerCase();
  if (cacheControl.includes('no-transform')) return false;
  const contentType = String(response.getHeader?.('Content-Type') || '').toLowerCase();
  if (!COMPRESSIBLE_TYPES.some((type) => contentType.includes(type))) return false;
  return chunk !== undefined && chunk !== null && Buffer.byteLength(chunk) >= threshold;
};

export const installResponseCompression = (request, response, threshold = 1024) => {
  const encoding = selectResponseEncoding(request.headers?.['accept-encoding']);
  if (!encoding) return;

  const originalEnd = response.end.bind(response);
  let ending = false;

  response.end = (chunk, chunkEncoding, callback) => {
    if (ending || !canCompressResponse(request, response, chunk, threshold)) {
      return originalEnd(chunk, chunkEncoding, callback);
    }
    ending = true;
    const bufferEncoding = typeof chunkEncoding === 'string' && Buffer.isEncoding(chunkEncoding) ? chunkEncoding : undefined;
    const input = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, bufferEncoding);
    const done = typeof chunkEncoding === 'function' ? chunkEncoding : callback;
    const finish = (error, output) => {
      if (error || !output) {
        originalEnd(chunk, typeof chunkEncoding === 'string' ? chunkEncoding : undefined, done);
        return;
      }
      response.setHeader('Content-Encoding', encoding);
      appendVary(response, 'Accept-Encoding');
      response.setHeader('Content-Length', output.length);
      originalEnd(output, undefined, done);
    };

    if (encoding === 'br') {
      zlib.brotliCompress(input, {
        params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 4 }
      }, finish);
    } else {
      zlib.gzip(input, { level: 6 }, finish);
    }
    return response;
  };
};
