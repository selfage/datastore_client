import { MessageDescriptor } from "@selfage/message/descriptor";

export interface DatastoreModelDescriptor<T> {
  name: string;
  key: string;
  excludedIndexes: Array<string>;
  valueDescriptor: MessageDescriptor<T>;
}

// Defined by Datastore API but not exported.
export type Operator = "=" | "<" | ">" | "<=" | ">=";
export interface DatastoreFilter {
  fieldName: string;
  fieldValue: any;
  operator: Operator;
}

export interface DatastoreOrdering {
  fieldName: string;
  descending: boolean;
}

export interface DatastoreQuery<T> {
  modelDescriptor: DatastoreModelDescriptor<T>;
  startCursor?: string;
  limit?: number;
  filters: Array<DatastoreFilter>;
  orderings: Array<DatastoreOrdering>;
}