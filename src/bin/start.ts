
import { QuadstoreHttpServer } from "../lib/index.js";
import { DataFactory } from 'rdf-data-factory';
import { MemoryLevel } from 'memory-level';
import { Quadstore } from "quadstore";

(async () => {

  const data_factory = new DataFactory();
  const { namedNode, literal, defaultGraph, quad } = data_factory;

  const quads = [
    quad(namedNode('ex://s0'), namedNode('ex://p0'), namedNode('ex://o0'), defaultGraph()),
    quad(namedNode('ex://s1'), namedNode('ex://p1'), literal('literal'), defaultGraph()),
    quad(namedNode('ex://s2'), namedNode('ex://p2'), namedNode('ex://o2'), defaultGraph()),
  ];

  const store = new Quadstore({
    backend: new MemoryLevel(),
    dataFactory: data_factory,
  });

  await store.open();

  await store.multiPut(quads);

  new QuadstoreHttpServer(store, {
    port: 8080,
    hostname: '127.0.0.1',
  });

  console.log(`

  test with:

    curl "http://127.0.0.1:8080/sparql?query=${encodeURIComponent('SELECT *  WHERE { ?s ?p ?o }')}"

  `);

})().catch(console.error);
