#!/usr/bin/env node

const colors = require("colors");
const express = require("express");
const fetch = require("node-fetch");
const yargs = require("yargs/yargs");
const { hideBin } = require("yargs/helpers");

type listener = {
  host?: string;
  target: string;
  port: number;
  logging?: boolean | string;
  targetPort?: number;
};

type data = {
  listeners: listener[];
};

class Master {
  _data: data;
  constructor() {
    this._data = { listeners: [] };
  }
  append(listener: listener) {
    this._data.listeners.push(listener);
  }
  info() {
    return this._data;
  }
  listeners() {
    return this._data.listeners;
  }
  error(arg: object | string | number) {
    console.log(colors.red(`[ERROR]:`), arg);
  }
}

const Troxy = new Master();
const argv: listener = yargs(hideBin(process.argv)).argv;

if (!argv.target) Troxy.error(`Please Provide a Valid Target Host`);
if (!argv.port) Troxy.error(`Please Provide A Valid Destination Port`);

Troxy.append({
  host: argv.host,
  port: argv.port,
  target: argv.target,
  targetPort: argv.targetPort,
  logging: argv.logging != null ? true : false,
});

Troxy.listeners().forEach((server) => {
  const app = express();
  app
    .use("*", function (req: any, res: any) {
      let methods: any = {
        GET: colors.green(req.method),
        POST: colors.blue(req.method),
        PUT: colors.yellow(req.method),
        DELETE: colors.red(req.method),
      };

      delete req.headers.host;
      fetch(`${server.target}${req.baseUrl}`, {
        method: req.method,
        headers: req.headers,
        body: req.body,
      })
        .then((response: any) => response.text())
        .then((data: any) => {
          res.end(data);
          if (server.logging) {
            console.log(
              `[${methods[req.method]}]: ${server.target}${req.baseUrl}`
            );
          }
        });
    })
    .listen(server.port);
  console.log(
    `${colors.blue(`[PROXY]:`)} ${server.target}:${
      server.targetPort || 80
    } Proxied to ${server.host || "http://localhost"}:${server.port}`
  );
});
