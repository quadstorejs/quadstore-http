import { describe, test, expect, beforeEach, beforeAll } from 'vitest'
import { SparqlEndpointFetcher } from 'fetch-sparql-endpoint'
import { DataFactory } from 'rdf-data-factory';
import { MemoryLevel } from 'memory-level';
import { Quadstore } from 'quadstore';
import { arrayifyStream } from 'arrayify-stream'
import { QuadstoreHono } from '../../src/lib/'

async function selectSPO(fetcher: SparqlEndpointFetcher) {
  const select = 'SELECT *  WHERE { ?s ?p ?o }'
  const bindingsStream = await fetcher.fetchBindings('/sparql', select)
  return await arrayifyStream(bindingsStream)
}

describe('SPARQL', () => {
  let fetcher: SparqlEndpointFetcher

  const data_factory = new DataFactory()
  const { namedNode, literal, defaultGraph, quad } = data_factory;

  const store = new Quadstore({
    backend: new MemoryLevel(),
    dataFactory: data_factory,
  });

  const app = new QuadstoreHono(store)

  beforeEach(async () => {
    await store.open();

    // @ts-ignore
    fetcher = new SparqlEndpointFetcher({ fetch: app.request })
  })

  beforeEach(async () => {
    await store.clear()
  })

  test('simple SELECT', async () => {
    const quads = [
      quad(namedNode('ex://s0'), namedNode('ex://p0'), namedNode('ex://o0'), defaultGraph()),
      quad(namedNode('ex://s1'), namedNode('ex://p1'), literal('literal'), defaultGraph()),
      quad(namedNode('ex://s2'), namedNode('ex://p2'), namedNode('ex://o2'), defaultGraph()),
    ];
    await store.multiPut(quads);
    expect(await selectSPO(fetcher)).toHaveLength(3)
  })

  test('simple INSERT Data', async () => {
    expect(await selectSPO(fetcher)).toHaveLength(0)
    const update = `INSERT DATA { <http://example.org/something> <http://example.org/hasSomething> "some value" . }`
    await fetcher.fetchUpdate('/sparql', update)
    expect(await selectSPO(fetcher)).toHaveLength(1)
  })
  test('can not update with GET', async () => {
    const update = `INSERT DATA { <http://example.org/something> <http://example.org/hasSomething> "some value" . }`
    const response = await app.request(`/sparql?query=${encodeURIComponent(update)}`)
    expect(response.status).toBe(405)
  })
})

