# @selfage/datastore_client

## Install

`npm install @selfage/datastore_client`

## Overview

Written in TypeScript and compiled to ES6 with inline source map & source. See [@selfage/tsconfig](https://www.npmjs.com/package/@selfage/tsconfig) for full compiler options. Provides type-safe Google Cloud Datastore APIs as a thin layer on top of `@google-cloud/datastore`, especially when using together with `@selfage/cli` to generate TypeScript code.

You are also encouraged to understand how Datastore works essentially before using this lib.

## Generate DatastoreModelDescriptor & QueryBuilder & composite indexes

With `@selfage/cli`, it rqeuires an input file, e.g., `task.json` which describes both the model and the message as the following.

```JSON
[{
  "enum": {
    "name": "Priority",
    "values": [{
      "name": "HIGH",
      "value": 1
    }, {
      "name": "DEFAULT",
      "value": 2
    }]
  }
}, {
  "message": {
    "name": "Task",
    "fields": [{
      "name": "id",
      "type": "string"
    }, {
      "name": "payload",
      "type": "string"
    }, {
      "name": "done",
      "type": "boolean"
    }, {
      "name": "priority",
      "type": "Priority"
    }, {
      "name": "created",
      "type": "number"
    }],
    "datastore": {
      "output": "./task_model",
      "key": "id",
      "indexes": [{
        "name": "TaskDone",
        "fields": [{
          "fieldName": "done"
        }, {
          "fieldName": "created",
          "descending": true
        }]
      }, {
        "name": "TaskDonePriority",
        "fields": [{
          "fieldName": "done"
        }, {
          "fieldName": "priority",
          "descending": true
        }, {
          "fieldName": "created",
          "descending": true
        }]
      }]
    }
  }
}]
```

The schema of this json file is an array of [Definition](https://github.com/selfage/cli/blob/0f724015a4ea309d80ff231db555fe0383c91329/generate/definition.ts#L73).

By running `selfage gen task -i index.yaml`, you will to get `task.ts`, `task_model.ts` and `index.yaml`.

See `@selfage/message` for detailed explanation of generating message and enum descriptors to help understand `task.json`. In short, `task.ts` will export `Task` interface, `TASK` message descriptor, `Priority` enum, and `PRIORITY` enum descriptor which are used by examples later as well as `task_model.ts` which is showing as below.

```TypeScript
import { DatastoreQuery, DatastoreFilter, DatastoreOrdering, Operator, DatastoreModelDescriptor } from '@selfage/datastore_client/model_descriptor';
import { Priority, Task, TASK } from './task';

export let TASK_MODEL: DatastoreModelDescriptor<Task> = {
  name: "Task",
  key: "id",
  excludedIndexes: ["id", "payload"],
  valueDescriptor: TASK,
}

export class TaskDoneQueryBuilder {
  private datastoreQuery: DatastoreQuery<Task>;

  public constructor() {
    this.datastoreQuery = {
      modelDescriptor: TASK_MODEL,
      filters: new Array<DatastoreFilter>(),
      orderings: [
        {
          fieldName: "created",
          descending: true
        },
      ]
    }
  }
  public start(cursor: string): this {
    this.datastoreQuery.startCursor = cursor;
    return this;
  }
  public limit(num: number): this {
    this.datastoreQuery.limit = num;
    return this;
  }
  public filterByDone(operator: Operator, value: boolean): this {
    this.datastoreQuery.filters.push({
      fieldName: "done",
      fieldValue: value,
      operator: operator,
    });
    return this;
  }
  public filterByCreated(operator: Operator, value: number): this {
    this.datastoreQuery.filters.push({
      fieldName: "created",
      fieldValue: value,
      operator: operator,
    });
    return this;
  }
  public build(): DatastoreQuery<Task> {
    return this.datastoreQuery;
  }
}

export class TaskDonePriorityQueryBuilder {
  private datastoreQuery: DatastoreQuery<Task>;

  public constructor() {
    this.datastoreQuery = {
      modelDescriptor: TASK_MODEL,
      filters: new Array<DatastoreFilter>(),
      orderings: [
        {
          fieldName: "priority",
          descending: true
        },
        {
          fieldName: "created",
          descending: true
        },
      ]
    }
  }
  public start(cursor: string): this {
    this.datastoreQuery.startCursor = cursor;
    return this;
  }
  public limit(num: number): this {
    this.datastoreQuery.limit = num;
    return this;
  }
  public filterByDone(operator: Operator, value: boolean): this {
    this.datastoreQuery.filters.push({
      fieldName: "done",
      fieldValue: value,
      operator: operator,
    });
    return this;
  }
  public filterByPriority(operator: Operator, value: Priority): this {
    this.datastoreQuery.filters.push({
      fieldName: "priority",
      fieldValue: value,
      operator: operator,
    });
    return this;
  }
  public filterByCreated(operator: Operator, value: number): this {
    this.datastoreQuery.filters.push({
      fieldName: "created",
      fieldValue: value,
      operator: operator,
    });
    return this;
  }
  public build(): DatastoreQuery<Task> {
    return this.datastoreQuery;
  }
}
```

It's recommended to commit `task_model.ts` as part of your project, because you will need to reference the generated code in other files. We will explain its usage as an example below.

It's also recommneded to commit `index.yaml` as well as upload it to Datastore, which looks like the following.

```YAML
indexes:
  - kind: Task
    properties:
      - name: created
        direction: desc
      - name: done
      - name: priority
        direction: desc
  - kind: Task
    properties:
      - name: created
        direction: desc
      - name: done
```

Only composite indexes will be included in it, as it's Datastore's requirement. And if you already have `index.yaml` in your project, and you run `selfage gen task_model -i index.yaml` again with new indexes in `task_model.json`, `index.yaml` will be updated to include new ones. And if you run `selfage gen user_model -i index.yaml` later for the other user model, `index.yaml` will be updated with those new indexes as well.

Note that if you deleted indexes from `task_model.json` and run `selfage gen task_model -i index.yaml`, those won't be deleted from `index.yaml`. You have to delete those indexes manually from `index.yaml` and from Datastore, when you are sure you don't need to keep them for backwards compatibility or future rollbacks.

## Create DatastoreClient

You can simply create a `DatastoreClient` with default Datastore configuration, which assumes you are running under Google Cloud environment, e.g., on a Compute Engine. Or pass in your own configured `Datastore` instance. See `@google-cloud/datastore` for their documents.

```TypeScript
import { DatastoreClient } from '@selfage/datastore_client';
import { Datastore } from '@google-cloud/datastore';

let client = DatastoreClient.create();
let client2 = new DatastoreClient(new Datastore());
```

## Save values

With `TASK_MODEL` generated above, you can save an array of values with it via `DatastoreClient`'s `save()`. The name of the model `Task` and the `id` field (because you specifed `"key": "id"`) will be used together as the Datastore key, which also means you have to populate `id` field ahead of time. And because you have defined what indexes you want to use, only properties referenced by those indexes will be actually indexed by Datastore, saving you from unnecessary Datastore operations.

```TypeScript
import { DatastoreClient } from '@selfage/datastore_client';
import { TASK_MODEL } from './task_model';
import { Task, Priority } from './task';

async function main(): void {
  let client = DatastoreClient.create();
  // Nothing is returned by save().
  await client.save([{
    id: '12345',
    payload: 'some params',
    done: false,
    priority: Priority.HIGH,
    created: 162311234
  }],
  TASK_MODEL,
  // Can also be 'update' or 'upsert'. See Datastore's doc for what they do.
  'insert');
}
```

Note that the `id` field is stripped and converted to Datastore key when saving. If you inspect your Datastore dashboard/console, or query directly from Datastore, you should expect the `id` field to not be set. The `id` field will be populated if you use get/query method described below.

## Allocate keys/ids

Because we have to populate `id` field (or whatever field you specified for `"key": ...`) before saving, you can either use a your own random number generator or use `DatastoreClient`'s `allocateKeys()`.

```TypeScript
import { DatastoreClient } from '@selfage/datastore_client';
import { TASK_MODEL } from './task_model';
import { Task, Priority } from './task';

async function main(): void {
  let client = DatastoreClient.create();
  // The `id` field will be populated in the returned `values`.
  let values = await client.allocateKeys([{
    payload: 'some params',
    done: false,
    priority: Priority.HIGH,
    created: 162311234
  }], TASK_MODEL);
}
```

Note the field for key has to be of string type and thus we will always store Datastore key as `[kind, name]`. This decision is opinionated that we don't have to struggle with number vs string when coding, reading or debugging.

Datastore actually allocate ids as int64 numbers, but JavaScript's number cannot be larger than 2^53. Therefore the response from Datastore is actually a 10-based string. We here further convert it to a base64 string to save a bit storage.

## Get values

Getting values is straightforward with a list of `id`.

```TypeScript
import { DatastoreClient } from '@selfage/datastore_client';
import { TASK_MODEL } from './task_model';
import { Task, Priority } from './task';

async function main(): void {
  let client = DatastoreClient.create();
  let values = await client.get(['12345', '23456'], TASK_MODEL);
}
```

## Query with QueryBuilder

A QueryBuilder is generated for each of `"indexes": ...`, named as `${index name}QueryBuilder`, and with `filterBy${captalized field name}()` function(s) which takes an `Operator` and a `value` as arguments. `Operator` is a [string literal type](https://github.com/selfage/datastore_client/blob/7301ab3718cdb120111e64de444c902b4e977a1b/model_descriptor.ts#L4).

```TypeScript
import { DatastoreClient } from '@selfage/datastore_client';
import { TASK_MODEL, TaskDoneQueryBuilder } from './task_model';

async function main(): void {
  let client = DatastoreClient.create();
  let taskDoneQuery = new TaskDoneQueryBuilder()
    .filterByDone('=', true)
    .filterByCreated('>', 1000100100)
    .filterByCreated('<', 2000200200)
    // .start(cursor) if you have one to use.
    .limit(10)
    .build();
  let {values, cursor} = await client.query(taskDoneQuery);
}
```

Note that you need to upload the generated `index.yaml` to Datastore to build those indexes first.

## Delete values

Simply providing a list of `id`.

```TypeScript
import { DatastoreClient } from '@selfage/datastore_client';
import { TASK_MODEL } from './task_model';
import { Task, Priority } from './task';

async function main(): void {
  let client = DatastoreClient.create();
  await client.delete(['12345', '23456'], TASK_MODEL);
}
```

## Transaction

`DatastoreClient` also acts as a factory to create transactions, which then can do all operations above but in a transaction. Finally you'd need to commit it.

```TypeScript
import { DatastoreClient } from '@selfage/datastore_client';

async function main(): void {
  let client = DatastoreClient.create();
  let transaction = await client.startTransaction();
  // await transaction.save([{}], TASK_MODEL, 'insert');
  // let values = await transaction.allocateKeys([{}], TASK_MODEL);
  // let values = await transaction.get(['12345', '23456'], TASK_MODEL);
  // await client.delete(['12345', '23456'], TASK_MODEL);
  // let {values, cursor} = await transaction.query(taskDoneQuery);
  await transaction.commit();
}
```

## Known issue

Note that if your Datastore model uses an enum which is defined a package, the generated Datastore model file cannot import that enum properly. Simplify the example above `task.json` as below.

```JSON
[{
  "message": {
    "name": "Task",
    "fields": [{
      "name": "id",
      "type": "string"
    }, {
      "name": "priority",
      "type": "Priority",
      "import": "priority_package"
    }],
    "datastore": {
      "output": "./task_model",
      "key": "id",
      "indexes": [{
        "name": "TaskPriority",
        "fields": [{
          "fieldName": "priority"
        }]
      }]
    }
  }
}]
```

By running `selfage gen task -i index.yaml`, you will get `task_model.ts` as below, igoring the other two files.

```TypeScript
import { DatastoreQuery, DatastoreFilter, DatastoreOrdering, Operator, DatastoreModelDescriptor } from '@selfage/datastore_client/model_descriptor';
import { Priority } from './priority_package';
import { Task, TASK } from './task';

export let TASK_MODEL: DatastoreModelDescriptor<Task> = {
  name: "Task",
  key: "id",
  excludedIndexes: ["id"],
  valueDescriptor: TASK,
}

export class TaskPriorityQueryBuilder {
  private datastoreQuery: DatastoreQuery<Task>;

  public constructor() {
    this.datastoreQuery = {
      modelDescriptor: TASK_MODEL,
      filters: new Array<DatastoreFilter>(),
      orderings: [
      ]
    }
  }
  public start(cursor: string): this {
    this.datastoreQuery.startCursor = cursor;
    return this;
  }
  public limit(num: number): this {
    this.datastoreQuery.limit = num;
    return this;
  }
  public filterByPriority(operator: Operator, value: Priority): this {
    this.datastoreQuery.filters.push({
      fieldName: "priority",
      fieldValue: value,
      operator: operator,
    });
    return this;
  }
  public build(): DatastoreQuery<Task> {
    return this.datastoreQuery;
  }
}
```

Note that `import { Priority } from './priority_package';` is incorrect, which should be `import { Priority } from 'priority_package';`.

It might seem easy to fix for this case. But it can get messy, if `task.ts` and `task_model.ts` are located in two directories, e.g., `./directory_a/task.ts` and `./directory_b/task_model.ts`, where each directory contains its own `./node_modules/` directory. Then `import { Priority } from 'priority_package';` inside `task.ts` resolves to `./directory_a/node_modules/priority_package`, whereas inside `task_model.ts` it resolves to `./directory_b/node_modules/priority_package`.

## Design considerations

We choose to define `datastore` field inside `message` because any change of `message` must be also reflected in the generated `DatastoreModelDescriptor` and `QueryBuilder` in one PR/git commit, to make sure fields are properly indexed. Otherwise, they might not be excluded from indexing or composite indexes might need to be back-filled. 
