#!/usr/bin/env node

import { ArgumentParser } from 'argparse';
import { Database, predicate, Query } from './main';

async function index(file: string, fields: string[]) {
  const db = new Database(file);
  await db.index(...fields.map(f => {
    const [name, type] = f.split(':');
    return { name, type };
  }));
}

async function find(file: string, queries: string[]) {
  const db = new Database(file);
  const iter = db.find(...queries.map(q => {
    const query: Query = {};
    let name = '';
    let ops: string[] = [];
    let values: any[] = [];
    let start = 0;
    let i = 0;
    const getValue = () => {
      const value = q.slice(start, i).trim();
      if (!value)
        throw new Error('Empty value');
      start = i;
      return value;
    };
    const addValue = () => {
      const value = getValue();
      values.push(
        value == 'null' ? null :
          value == 'false' ? false :
            value == 'true' ? true :
              Number.isFinite(Number(value)) ? Number(value) : value
      );
    };
    const addPredicate = () => {
      query[name] = ops[0] == '=' ?
        values[0] : predicate(ops as any, ...values);
      name = '';
      ops = [];
      values = [];
    };
    for (; i < q.length; i++) {
      const c = q[i];
      if (['<', '>', '='].includes(c)) {
        if (!name)
          name = getValue();
        else if (ops.length)
          addValue();
        const op = q.slice(start, i + 1 + Number(q[i + 1] == '='));
        ops.push(op);
        i += op.length - 1;
        start = i + 1;
      } else if (c == ',') {
        addValue();
        start += 1;
        addPredicate();
      }
    }
    addValue();
    addPredicate();
    return query;
  }));

  for await (const record of iter)
    console.log(JSON.stringify(record));
}

async function main() {
  const parser = new ArgumentParser({
    version: require('../package.json').version,
    addHelp: true,
    description: 'query JSON files'
  });

  const subparsers = parser.addSubparsers({ dest: 'command' });

  const commands = {
    index: subparsers.addParser(
      'index', { help: 'index JSON file' },
    ),
    find: subparsers.addParser(
      'find', { help: 'query JSON file' },
    )
  };

  // Index
  commands.index.addArgument('file');
  commands.index.addArgument('--field', { action: 'append' });

  // Find
  commands.find.addArgument('file');
  commands.find.addArgument('--query', { action: 'append' });

  const args = parser.parseArgs();
  switch (args.command) {
    case 'index':
      await index(args.file, args.field);
      break;
    case 'find':
      await find(args.file, args.query);
      break;
  }
}

process.on('unhandledRejection', err => { throw err; });

main();
