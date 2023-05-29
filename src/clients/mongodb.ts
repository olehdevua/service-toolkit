// https://github.com/mongodb/mongo/blob/master/src/mongo/base/error_codes.yml

import { inspect } from "util";
import { v1, validate } from "uuid";
import {
  MongoClient,
  MongoClientOptions,
  Binary,
  ObjectId,
  Db,
  WriteConcernSettings,
  ReadConcern,
  MongoError,
  MongoNetworkError,
  MongoAPIError,
  MongoServerError,
  Filter,
  FindOneAndUpdateOptions,
  FindOptions,
  Document,
  UpdateFilter
} from "mongodb";
import { DBError, DBOpsError } from "../errors.js";
import { strict as assertStrict } from "assert";

const ID = /Id$/;

export type MongodbClientOpts = MongoClientOptions;

type MongodbSubError = {
  servers: Map<string, { error?: MongoError }>;
  type: string;
};
type MongodbErrReason = string | MongodbSubError;

export class MongodbClient {
  constructor(
    public client: MongoClient,
    public db: Db,
  ) {}

  static async init(
    url: string,
    opts: MongodbClientOpts
  ): Promise<MongodbClient> {
    try {
      const client = new MongoClient(url, opts);
      client.startSession();
      await client.connect();
      const db = client.db();

      return new MongodbClient(client, db);
    } catch(err) {
      throw mapToDBError(err);
    }
  }

  static generateUUID(): Binary {
    const uuid = v1(null, Buffer.alloc(16));
    return new Binary(uuid, Binary.SUBTYPE_UUID);
  }

  static mapUUIDToBinary(uuid: string): Binary {
    const isValid = validate(uuid);
    // NOTE: (can remove this note later)
    // Again: this is not validation error.
    // Validation error can be thrown only ON VALIDATION STEP,
    // that is service-input and model validation
    // More over this is a LIBRARY - so it can be used
    // not in app at all.
    if (!isValid) throw new Error(`UUID is not valid. uuid = ${uuid}`);

    const normalizedUUID = uuid.replace(/-/g, "");
    const buf = Buffer.from(normalizedUUID, "hex");
    return new Binary(buf, Binary.SUBTYPE_UUID);
  }

  // TODO: `uuid@8.3` module has now `stringify` fn, test it
  static mapBinaryToUUID(binary: Binary): string {
    assertStrict(binary, "Binary is undefined");
    assertStrict.equal(binary.sub_type, Binary.SUBTYPE_UUID, `Binary is not UUID. ${inspect(binary)}`);
    return [
      binary.buffer.toString("hex", 0, 4),
      binary.buffer.toString("hex", 4, 6),
      binary.buffer.toString("hex", 6, 8),
      binary.buffer.toString("hex", 8, 10),
      binary.buffer.toString("hex", 10, 16),
    ].join("-");
  }


  // NOTE: this is (quick) simplified version, probably need
  // refactoring/redesign
  static mapToEntity(
    model: Record<string, any>
  ): Record<string, unknown> {
    const entity: Record<string, unknown> = {};

    for (const key in model) {
      const value = model[key];

      if (key === "id") {
        entity["_id"] = MongodbClient.mapUUIDToBinary(value);
      } else if (ID.test(key)) {
        entity[key] = MongodbClient.mapUUIDToBinary(value);
      } else if (value instanceof Buffer) {
        entity[key] = new Binary(value, Binary.SUBTYPE_USER_DEFINED);
      } else if (value instanceof Object) {
        entity[key] = MongodbClient.mapToEntity(value);
      } else {
        entity[key] = value;
      }
    }

    return entity;
  }

  static mapToModel(
    entity: Record<string, any>
  ): Record<string, unknown> {
    const model: Record<string, unknown> = {};

    for (const key in entity) {
      const value = entity[key];

      if (key === "_id") {
        model["id"] = MongodbClient.mapBinaryToUUID(value);
      } else if (ID.test(key)) {
        model[key] = MongodbClient.mapBinaryToUUID(value);
      } else if (value instanceof Object) {
        model[key] = MongodbClient.mapToModel(value);
      } else {
        model[key] = value;
      }
    }

    return model;
  }

  /*
   * in case you want to add method to update schema of
   * existing collection
   *
   * https://www.mongodb.com/docs/manual/reference/command/collMod/#add-document-validation-to-an-existing-collection
   */
  async createCollection(
    name: string,
    opts: {
      schema: Record<string, unknown>,
      writeConcern?: WriteConcernSettings,
      readConcern?: ReadConcern,
    }
  ): Promise<void> {
    try {
      await this.db.createCollection(name, {
        validator: opts.schema,
        writeConcern: { w: "majority", wtimeout: 10000, j: true, ...opts.writeConcern },
        readConcern: opts.readConcern || { level: ReadConcern.MAJORITY }, // default "local"
        // NOTE: throw if collection exists.
        // That's handle this situation by hand,
        // because otherwise this fn should be extra
        // smart to handle it properly.
        // What if schema is different?
        // Should we compare them, after that should we update
        // collection schema? so... too complicated
        //
        // DEPRECATED: ^- looks like even old doc tells that throw if collection not exist,
        //            of course it's not exist, because I just trying to create it
        //strict: true,
      });
    } catch (err) {
      throw mapToDBError(err);
    }
  }

  // TODO: handle session
  // session potentially necessary for transactions
  //    (don't forget to handle transaction closing in case
  //      breakage)
  //
  // errors primary use-case for connection breakage (P.S. WHAT?
  //    how you can handle connection breakage? let's it raise)
  //
  // NOTE: I updated `collection` type to string, instead
  // of enum of collection names, since it's up to Repositories
  // to determine the collection name, and mongo client doesn't
  // care !
  async findOne(
    collection: string,
    query: Filter<any>,
    opts: FindOptions = {}
  ): Promise<Document | null> {
    try {
      return this.db.collection(collection).findOne(query, opts);
    } catch (err) {
      throw mapToDBError(err, collection);
    }
  }

  async insertOne(
    collection: string,
    doc: Record<string, unknown>,
    opts: Record<string, unknown> = {}
  ): Promise<unknown> {
    let resp; try {
      resp = await this.db
        .collection(collection)
        .insertOne(doc, opts);
    } catch (err) {
      throw mapToDBError(err, collection);
    }

    return resp.insertedId;
  }

  async insertMany(
    collection: string,
    docs: Record<string, unknown>[],
    opts: Record<string, unknown> = {}
  ): Promise<ObjectId[]> {
    let resp; try {
      resp = await this.db
        .collection(collection)
        .insertMany(docs, opts);
    } catch (err) {
      throw mapToDBError(err, collection);
    }

    const insertedCount = resp.insertedCount ?? 0;
    if (opts.strict === true && insertedCount !== docs.length) {
      // TODO: probably `DBNotAllInserted extends DBOpsError`
      throw new DBOpsError("Not all documents are processed", {
        params: {
          collection,
          op: "insertMany",
          insertedIds: resp.insertedIds
        }
      });
    }

    return Object.values(resp.insertedIds);
  }

  // TODO: go through this fn again
  // since I wrote it quickly at midnight
  async findOneAndUpdate(
    collection: string,
    filter: Filter<any>,
    update: UpdateFilter<any>,
    opts: FindOneAndUpdateOptions = {}
  ): Promise<Record<string, unknown> | null> {
    let resp; try {
      resp = await this.db
        .collection(collection)
        .findOneAndUpdate(filter, update, opts);
    } catch (err) {
      throw mapToDBError(err);
    }

    if (!resp.ok) throw (
      new DBError("findOneAndUpdate failed", {
        params: {
          op: "findOneAndUpdate",
          collection,
          filter,
          lastError: resp.lastErrorObject
        }
      })
    );

    return resp.value;
  }
}

function mapToDBError(
  err: unknown,
  collection?: string
): Error {
  if (err instanceof MongoError) {
    const message = err.message || err.errmsg;
    const name = err.name;
    const errInfo = (err as unknown as Record<string, unknown>).errInfo;
    // const code = err.code;
    const reason = getReason(err);

    const isOpsErr = (
      err instanceof MongoNetworkError ||
      err instanceof MongoAPIError ||
      err instanceof MongoServerError
    );

    if (isOpsErr) {
      return new DBOpsError(message, {
        cause: err,
        params: { name, collection, errInfo, reason }
      });
    }

    return new DBError(message, {
      cause: err,
      params: { name, collection, errInfo, reason }
    });
  }
  return err as Error;
}

function getReason(err: Error & { reason?: MongodbErrReason }): string {
  if (!err.reason) return "";
  if (typeof err.reason === "string") return err.reason;

  const subErr = err.reason.servers?.values().next().value?.error;
  return JSON.stringify({
    name: err.reason.constructor.name,
    type: err.reason.type,
    subErr: subErr && `${subErr?.message} ${subErr?.name}`
  });
}
