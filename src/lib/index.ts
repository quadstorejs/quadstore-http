
import { Hono } from "hono";
import { serve, ServerType } from "@hono/node-server";
import { ServerOptions } from "@hono/node-server/dist/types";
import { Quadstore } from "quadstore";
import { server as debug } from "./debug.js";
import EventEmitter from "node:events";
import { initSparqlController } from "./controllers/sparql.js";
import { AddressInfo } from "node:net";

export type Opts = ServerOptions & {
  baseUrl?: URL;
  maxLimit?: number;
  perPageCount?: number;
  hostname?: string;
  port?: number;
};

export interface Events {
  listening: [];
  error: [Error];
  close: [];
}

export class QuadstoreHono extends Hono {
  constructor(store: Quadstore) {
    super()
    initSparqlController(this, store);
  }
}

export class QuadstoreHttpServer extends EventEmitter<Events> {

  #app: Hono;
  #server: ServerType;

  constructor(store: Quadstore, opts: Opts = {}) {
    super();
    this.#app = new QuadstoreHono(store);
    this.#server = serve({
      ...opts,
      hostname: opts.hostname ?? '127.0.0.1',
      port: opts.port ?? 8080,
      fetch: this.#app.fetch,
    });
    this.#server.on('close', this.#onClose);
    this.#server.on('error', this.#onError);
    this.#server.on('listening', this.#onListen);

    this.#app.use(async (ctx, next) => {
      const now = Date.now();
      const signature = `[${ctx.req.method}] ${ctx.req.url}`;
      debug(`${signature}`);
      await next();
      const then = Date.now();
      debug(`${signature} - ${ctx.res.status} (${then - now}ms)`);
    });
  }

  #onListen = () => {
    const { address, port } = this.#server.address() as AddressInfo;
    debug('listening on %s:%s', address, port);
    this.emit('listening');
  };

  #onError = (err: Error) => {
    this.emit('error', err);
  };

  #onClose = () => {
    this.emit('close');
  }

  async listen(): Promise<void> {
    return new Promise((resolve, reject) => {
      const onError = (err: Error) => {
        cleanup();
        reject(err);
      };
      const onListen = () => {
        cleanup();
        resolve();
      };
      const cleanup = () => {
        this.#server.removeListener('error', onError);
        this.#server.removeListener('listening', onListen);
      };
      this.#server.on('error', onError);
      this.#server.on('listening', onListen);
      this.#server.listen();
    });
  }

  async close(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.#server.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
}
