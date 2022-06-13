#!/usr/bin/env node

import fs from "fs";
import path from "path";

import { table } from "table";
const colors = require("colors");
const express = require("express");
const fetch = require("node-fetch");
const pidusage = require("pidusage");
const yargs = require("yargs/yargs");
const daemonizeProcess = require("daemonize-process");

const { hideBin } = require("yargs/helpers");
const { spawn } = require("node:child_process");

type listener = {
  pid: number;
  host?: string;
  target: string;
  list?: any;
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
  info(arg: any) {
    console.log(`${colors.blue(`[INFO]:`)}`, arg);
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

const Root: string = __dirname.replace(`${path.basename(__dirname)}`, "");

var Daemons: object[] = [];
try {
  Daemons = JSON.parse(fs.readFileSync(`${Root}/cache/daemons.json`, "utf-8"));
} catch {
  Daemons = [];
}

if (argv.target && argv.port) {
  Troxy.append({
    pid: process.pid,
    host: argv.host,
    port: argv.port,
    target: argv.target,
    targetPort: argv.targetPort,
    logging: argv.logging != null ? true : false,
  });
  daemonizeProcess();
}

Troxy.listeners().forEach((server: listener) => {
  Daemons.push(server);
  fs.writeFileSync(
    `${Root}/cache/daemons.json`,
    JSON.stringify(Daemons),
    "utf-8"
  );
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
    } Proxied to ${server.host || "http://127.0.0.1"}:${server.port}`
  );
});

if (argv.list) {
  async function main() {
    const Daemons: listener[] =
      JSON.parse(fs.readFileSync(`${Root}/cache/daemons.json`, "utf-8")) || {};

    const Final: any[] = [
      ["Index", "Target Host", "Port", "ProcessID", "CPU", "Memory", "Elapsed"],
    ];
    const ReDat: any[] = [];
    async function getInfo(pid: number) {
      return new Promise((res, rej) => {
        try {
          pidusage(pid, function (err: any, stats: any) {
            if (err) {
              rej(err);
            } else {
              res(stats);
            }
          });
        } catch {
          rej(`Error`);
        }
      });
    }

    let index: number = 0;
    for (const daemon of Daemons) {
      index++;
      await getInfo(daemon.pid)
        .then(async (data: any) => {
          const done = await Final.push([
            index,
            daemon.target,
            daemon.port,
            data.pid || "???",
            data.cpu,
            `${(data.memory / 1000 / 1000).toFixed(3)}MB`,
            `${(data.elapsed / 1000).toFixed(3)}s`,
          ]);
          return done;
        })
        .catch((err) => {});
    }

    console.log(table(Final));
  }
  main();
}
