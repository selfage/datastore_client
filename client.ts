import bigInt = require("big-integer");
import { DatastoreModelDescriptor, DatastoreQuery } from "./model_descriptor";
import {
  Datastore,
  DatastoreRequest,
  Key,
  Transaction,
} from "@google-cloud/datastore";
import { parseMessage } from "@selfage/message/parser";

// Should be defined by Datastore but not exported.
export type SaveMethod = "insert" | "update" | "upsert";

interface Entity {
  key: Key;
  data: any;
  excludeFromIndexes: Array<string>;
  method: SaveMethod;
}

function parseValue<T>(
  rawValue: any,
  descriptor: DatastoreModelDescriptor<T>
): T {
  let value = parseMessage(rawValue, descriptor.valueDescriptor);
  (value as any)[descriptor.key] = rawValue[Datastore.KEY].name;
  return value;
}

async function allocateKeys<T>(
  datastoreRequest: DatastoreRequest,
  values: Array<T>,
  descriptor: DatastoreModelDescriptor<T>
): Promise<Array<T>> {
  let incompleteKey = new Key({ path: [descriptor.name] });
  let response = await datastoreRequest.allocateIds(
    incompleteKey,
    values.length
  );
  let keys = response[0] as Array<Key>;
  for (let i = 0; i < keys.length; i++) {
    let uint8Array = bigInt(keys[i].id).toArray(256).value;
    (values[i] as any)[descriptor.key] =
      Buffer.from(uint8Array).toString("base64");
  }
  return values;
}

async function getValuesByKeys<T>(
  datastoreRequest: DatastoreRequest,
  keys: Array<string>,
  descriptor: DatastoreModelDescriptor<T>
): Promise<Array<T>> {
  let datastoreKeys = new Array<Key>();
  for (let key of keys) {
    datastoreKeys.push(new Key({ path: [descriptor.name, key] }));
  }
  let response = await datastoreRequest.get(datastoreKeys);
  let results = new Array<T>();
  for (let rawValue of response[0]) {
    results.push(parseValue(rawValue, descriptor));
  }
  return results;
}

async function deleteByKeys<T>(
  datastoreRequest: DatastoreRequest,
  keys: Array<string>,
  descriptor: DatastoreModelDescriptor<T>
): Promise<void> {
  let datastoreKeys = new Array<Key>();
  for (let key of keys) {
    datastoreKeys.push(new Key({ path: [descriptor.name, key] }));
  }
  await datastoreRequest.delete(datastoreKeys);
}

async function saveValues<T>(
  datastoreRequest: DatastoreRequest,
  values: Array<T>,
  descriptor: DatastoreModelDescriptor<T>,
  method: SaveMethod
): Promise<void> {
  let entities = new Array<Entity>();
  for (let value of values) {
    let keyValue = (value as any)[descriptor.key];
    let key = new Key({
      path: [descriptor.name, keyValue],
    });
    delete (value as any)[descriptor.key];
    entities.push({
      key: key,
      data: value,
      excludeFromIndexes: descriptor.excludedIndexes,
      method: method,
    });
  }
  await datastoreRequest.save(entities);
}

async function queryValues<T>(
  datastoreRequest: DatastoreRequest,
  datastoreQuery: DatastoreQuery<T>
): Promise<{ values: Array<T>; cursor?: string }> {
  let query = datastoreRequest.createQuery(datastoreQuery.modelDescriptor.name);
  if (datastoreQuery.startCursor) {
    query.start(datastoreQuery.startCursor);
  }
  if (datastoreQuery.limit) {
    query.limit(datastoreQuery.limit);
  }
  for (let filter of datastoreQuery.filters) {
    query.filter(filter.fieldName, filter.operator, filter.fieldValue);
  }
  for (let ordering of datastoreQuery.orderings) {
    query.order(ordering.fieldName, { descending: ordering.descending });
  }
  let response = await query.run();
  let values = new Array<T>();
  for (let rawValue of response[0]) {
    values.push(parseValue(rawValue, datastoreQuery.modelDescriptor));
  }
  let cursor: string;
  if (response[1].moreResults !== "NO_MORE_RESULTS") {
    cursor = response[1].endCursor;
  }
  return {
    values,
    cursor,
  };
}

export class DatastoreClient {
  public constructor(private datastore: Datastore) {}

  // Use default Datastore constructor.
  public static create(): DatastoreClient {
    let datastore = new Datastore();
    return new DatastoreClient(datastore);
  }

  public async startTransaction(): Promise<DatastoreTransaction> {
    let [transaction] = await this.datastore.transaction().run();
    return new DatastoreTransaction(transaction);
  }

  public async allocateKeys<T>(
    values: Array<T>,
    descriptor: DatastoreModelDescriptor<T>
  ): Promise<Array<T>> {
    return allocateKeys(this.datastore, values, descriptor);
  }

  public async get<T>(
    keys: Array<string>,
    descriptor: DatastoreModelDescriptor<T>
  ): Promise<Array<T>> {
    return getValuesByKeys(this.datastore, keys, descriptor);
  }

  public async delete<T>(
    keys: Array<string>,
    descriptor: DatastoreModelDescriptor<T>
  ): Promise<void> {
    return deleteByKeys(this.datastore, keys, descriptor);
  }

  public async save<T>(
    values: Array<T>,
    descriptor: DatastoreModelDescriptor<T>,
    method: SaveMethod
  ): Promise<void> {
    return saveValues(this.datastore, values, descriptor, method);
  }

  public async query<T>(
    datastoreQuery: DatastoreQuery<T>
  ): Promise<{ values: Array<T>; cursor?: string }> {
    return queryValues(this.datastore, datastoreQuery);
  }
}

export class DatastoreTransaction {
  public constructor(private transaction: Transaction) {}

  public async allocateKeys<T>(
    values: Array<T>,
    descriptor: DatastoreModelDescriptor<T>
  ): Promise<Array<T>> {
    return allocateKeys(this.transaction, values, descriptor);
  }

  public async get<T>(
    keys: Array<string>,
    descriptor: DatastoreModelDescriptor<T>
  ): Promise<Array<T>> {
    return getValuesByKeys(this.transaction, keys, descriptor);
  }

  public async delete<T>(
    keys: Array<string>,
    descriptor: DatastoreModelDescriptor<T>
  ): Promise<void> {
    return deleteByKeys(this.transaction, keys, descriptor);
  }

  public async save<T>(
    values: Array<T>,
    descriptor: DatastoreModelDescriptor<T>,
    method: SaveMethod
  ): Promise<void> {
    return saveValues(this.transaction, values, descriptor, method);
  }

  public async query<T>(
    datastoreQuery: DatastoreQuery<T>
  ): Promise<{ values: Array<T>; cursor?: string }> {
    return queryValues(this.transaction, datastoreQuery);
  }

  public async commit(): Promise<void> {
    await this.transaction.commit();
  }
}
