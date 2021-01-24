import { DatastoreModelDescriptor, DatastoreQuery } from "./model_descriptor";
import { Datastore, Key, Query, Transaction } from "@google-cloud/datastore";
import { parseMessage } from "@selfage/message/parser";

// Should be defined by Datastore but not exported.
export type SaveMethod = "insert" | "update" | "upsert";

interface Entity {
  key: Key;
  data: any;
  excludeFromIndexes: Array<string>;
  method: SaveMethod;
}

export class DatastoreClient {
  public constructor(private datastore: Datastore) {}

  // Use default Datastore constructor.
  public static create(): DatastoreClient {
    let datastore = new Datastore();
    return new DatastoreClient(datastore);
  }

  public async startTransaction(): Promise<Transaction> {
    let [transaction] = await this.datastore.transaction().run();
    return transaction;
  }

  // Only use for numberic keys.
  public async allocateKeys<T>(
    values: Array<T>,
    descriptor: DatastoreModelDescriptor<T>,
    transaction?: Transaction
  ): Promise<Array<T>> {
    let incompleteKey = this.datastore.key([descriptor.name]);
    let response: any;
    if (!transaction) {
      response = await this.datastore.allocateIds(incompleteKey, values.length);
    } else {
      response = await transaction.allocateIds(incompleteKey, values.length);
    }
    let keys = response[0] as Array<Key>;
    for (let i = 0; i < keys.length; i++) {
      (values[i] as any)[descriptor.key] = keys[i].path[1];
    }
    return values;
  }

  public async get<T>(
    keys: Array<string>,
    descriptor: DatastoreModelDescriptor<T>,
    transaction?: Transaction
  ): Promise<Array<T>> {
    let datastoreKeys = new Array<Key>();
    for (let key of keys) {
      datastoreKeys.push(this.datastore.key([descriptor.name, key]));
    }
    let response: any;
    if (!transaction) {
      response = await this.datastore.get(datastoreKeys);
    } else {
      response = await transaction.get(datastoreKeys);
    }
    let results = new Array<T>();
    for (let rawValue of response[0]) {
      results.push(parseMessage(rawValue, descriptor.valueDescriptor));
    }
    return results;
  }

  public async save<T>(
    values: Array<T>,
    descriptor: DatastoreModelDescriptor<T>,
    method: SaveMethod,
    transaction?: Transaction
  ): Promise<void> {
    let entities = new Array<Entity>();
    for (let value of values) {
      let key = this.datastore.key([
        descriptor.name,
        (value as any)[descriptor.key],
      ]);
      entities.push({
        key: key,
        data: value,
        excludeFromIndexes: descriptor.excludedIndexes,
        method: method,
      });
    }
    if (!transaction) {
      await this.datastore.insert(entities);
    } else {
      await transaction.insert(entities);
    }
  }

  public async query<T>(
    datastoreQuery: DatastoreQuery<T>,
    descriptor: DatastoreModelDescriptor<T>,
    transaction?: Transaction
  ): Promise<{ values: Array<T>; cursor?: string }> {
    let query: Query;
    if (!transaction) {
      query = this.datastore.createQuery(descriptor.name);
    } else {
      query = transaction.createQuery(descriptor.name);
    }
    if (datastoreQuery.startToken) {
      query.start(datastoreQuery.startToken);
    }
    if (datastoreQuery.limit) {
      query.limit(datastoreQuery.limit);
    }
    for (let ordering of datastoreQuery.orderings) {
      query.order(ordering.indexName, { descending: ordering.descending });
    }
    for (let filter of datastoreQuery.filters) {
      query.filter(filter.indexName, filter.operator, filter.indexValue);
    }
    let response = await query.run();
    let values = new Array<T>();
    for (let rawValue of response[0]) {
      values.push(parseMessage(rawValue, descriptor.valueDescriptor));
    }
    let cursor = response[1].endCursor;
    return {
      values: values,
      cursor: cursor,
    };
  }
}
