import { MessageDescriptor } from "@selfage/message/descriptor";

// Defined by Datastore API but not exported.
export type Operator = "=" | "<" | ">" | "<=" | ">=";
export interface DatastoreFilter {
  indexName: string;
  indexValue: any;
  operator: Operator;
}

export interface DatastoreOrdering {
  indexName: string;
  descending: boolean;
}

export interface DatastoreQuery<T> {
  startToken?: string;
  limit?: number;
  filters: Array<DatastoreFilter>;
  orderings: Array<DatastoreOrdering>;
}

export interface DatastoreModelDescriptor<T> {
  name: string;
  key: string;
  excludedIndexes: Array<string>;
  valueDescriptor: MessageDescriptor<T>;
}
