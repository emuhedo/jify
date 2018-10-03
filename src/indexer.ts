import Index, { ObjectField, IndexCache } from './index';

const size = 1_000_000;
let batch: ObjectField[] = [];

const cache: IndexCache = new Map();

async function main(filename: string) {
  const index = new Index(filename);

  await index.open();

  function insertBatch() {
    const b = batch;
    batch = [];
    if (b.length)
      index.insert(b, cache);
  }

  const handler = async (objectFields?: ObjectField[]) => {
    if (objectFields == null) {
      // Insert remaining fields
      insertBatch();
      // Cleanup
      process.off('message', handler);
      process.once('beforeExit', async () => {
        await index.close();
      });
      return;
    }

    batch.push(...objectFields);
    if (batch.length >= size)
      insertBatch();
  };

  process.on('message', handler);
  process.send!('ready');
}

process.once('unhandledRejection', err => { throw err; });

main(process.argv[2]);
