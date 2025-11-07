
import { Context, Hono } from "hono";
import { accepts } from "hono/accepts";
import { Quadstore } from "quadstore";
import { QueryEngine } from '@comunica/query-sparql-rdfjs';


const negotiateBindingsFormat = (ctx: Context): string => {
  const result = accepts(ctx, {
    header: 'Accept',
    supports: [
      'application/json',
      'application/sparql-results+xml',
      'application/sparql-results+json',
    ],
    default: 'application/sparql-results+json',
  });
  return result;
};

const negotiateQuadsFormat = (ctx: Context): string => {
  const result = accepts(ctx, {
    header: 'Accept',
    supports: [
      'application/trig',
      'application/n-quads',
    ],
    default: 'application/n-quads',
  });
  return result;
};

const readableToString = (readable: NodeJS.ReadableStream): Promise<string> => {
  return new Promise((resolve, reject) => {
    let buffer = '';
    const onData = (chunk: string) => {
      buffer += chunk;
    };
    const onEnd = () => {
      cleanup();
      resolve(buffer);
    };
    const onError = (err: Error) => {
      cleanup();
      reject(err);
    };
    const cleanup = () => {
      readable.removeListener('data', onData);
      readable.removeListener('end', onEnd);
      readable.removeListener('error', onError);
    };
    readable.setEncoding('utf8');
    readable.on('data', onData);
    readable.on('end', onEnd);
    readable.on('error', onError);
  });
};

export const initSparqlController = (app: Hono, store: Quadstore) => {

  const engine = new QueryEngine();

  app.all('/sparql', async (ctx) => {

    let query: any;

    if (ctx.req.method === 'POST') {
      switch (ctx.req.header('content-type')) {
        case 'application/sparql-query':
          query = await ctx.req.text();
          break;
        case 'application/x-www-form-urlencoded':
          query = (await ctx.req.parseBody()).query;
          break;
        default:
          return ctx.json({ error: 'unsupported content-type' }, 400);
      }
    } else if (ctx.req.method === 'GET') {
      query = ctx.req.query('query');
    } else {
      return ctx.json({ error: 'unsupported HTTP method' });
    }

    if (typeof query !== 'string') {
      return ctx.json({ error: 'invalid query' }, 400);
    }

    const has_quad_result = /\s*(?:CONSTRUCT|DESCRIBE)/i.test(query);

    if (has_quad_result) {
      const result_format = negotiateQuadsFormat(ctx);
      ctx.header('content-type', result_format);
      const quad_stream = await engine.query(query, { sources: [store] });
      const result = await engine.resultToString(quad_stream, result_format);
      return ctx.body(await readableToString(result.data), 200);
    }

    const result_format = negotiateBindingsFormat(ctx);
    ctx.header('content-type', result_format);
    const binding_stream = await engine.query(query, { sources: [store] });
    const result = await engine.resultToString(binding_stream, result_format);
    return ctx.body(await readableToString(result.data), 200);
  });


};
