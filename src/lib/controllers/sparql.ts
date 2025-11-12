import { Context, Hono } from 'hono'
import { accepts } from 'hono/accepts'
import { stream } from 'hono/streaming'
import { Readable } from 'node:stream'
import { Quadstore } from 'quadstore'

import { QueryEngine } from '@comunica/query-sparql-rdfjs'

const negotiateBindingsFormat = (ctx: Context): string => {
  const result = accepts(ctx, {
    header: 'Accept',
    supports: [
      'application/json',
      'application/sparql-results+xml',
      'application/sparql-results+json',
    ],
    default: 'application/sparql-results+json',
  })
  return result
}

const negotiateQuadsFormat = (ctx: Context): string => {
  const result = accepts(ctx, {
    header: 'Accept',
    supports: ['application/trig', 'application/n-quads'],
    default: 'application/n-quads',
  })
  return result
}

export const initSparqlController = (app: Hono, store: Quadstore) => {
  const engine = new QueryEngine()

  app.all('/sparql', async (ctx) => {
    let query: any

    if (ctx.req.method === 'POST') {
      switch (ctx.req.header('content-type')) {
        case 'application/sparql-query':
        case 'application/sparql-update':
          query = await ctx.req.text()
          break
        case 'application/x-www-form-urlencoded':
          query = (await ctx.req.parseBody()).query
          break
        default:
          return ctx.json({ error: 'unsupported content-type' }, 400)
      }
    } else if (ctx.req.method === 'GET') {
      query = ctx.req.query('query')
    } else {
      return ctx.json({ error: 'unsupported HTTP method' })
    }

    if (typeof query !== 'string') {
      return ctx.json({ error: 'invalid query' }, 400)
    }

    const query_result = await engine.query(query, {
      sources: [store],
      destination: store,
    })

    if (query_result.resultType === 'void') {
      if (ctx.req.method === 'GET') {
        return ctx.json({ error: 'unsupported method for update query' }, 405)
      }
      await query_result.execute()
      return ctx.body(null, 204)
    }

    const result_format =
      query_result.resultType === 'quads' ? negotiateQuadsFormat(ctx) : negotiateBindingsFormat(ctx)

    ctx.header('content-type', result_format)

    const string_result = await engine.resultToString(query_result, result_format)

    ctx.status(200)

    return stream(ctx, async (stream) => {
      await stream.pipe(Readable.toWeb(string_result.data as Readable) as ReadableStream)
    })
  })
}
