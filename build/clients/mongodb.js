import { v1, validate } from "uuid";
import { MongoClient, Binary, ReadConcern, MongoError, MongoNetworkError, MongoAPIError, MongoServerError, } from "mongodb";
import { DBError, DBOpsError } from "../errors.js";
import { strict as assertStrict } from "assert";
const id = /Id$/;
export class MongodbClient {
    client;
    db;
    constructor(client, db) {
        this.client = client;
        this.db = db;
    }
    static async init(url, opts) {
        try {
            const client = new MongoClient(url, opts);
            await client.connect();
            const db = client.db();
            return new MongodbClient(client, db);
        }
        catch (err) {
            throw mapToDBError(err);
        }
    }
    static generateUUID() {
        const uuid = v1(null, Buffer.alloc(16));
        return new Binary(uuid, Binary.SUBTYPE_UUID);
    }
    static mapUUIDToBinary(uuid) {
        const isValid = validate(uuid);
        if (!isValid)
            throw new Error(`UUID is not valid. uuid = ${uuid}`);
        const normalizedUUID = uuid.replace(/-/g, "");
        const buf = Buffer.from(normalizedUUID, "hex");
        return new Binary(buf, Binary.SUBTYPE_UUID);
    }
    static mapBinaryToUUID(binary) {
        assertStrict(binary, "Binary is undefined");
        assertStrict.equal(binary.sub_type, Binary.SUBTYPE_UUID, "Binary is not UUID");
        return [
            binary.buffer.toString("hex", 0, 4),
            binary.buffer.toString("hex", 4, 6),
            binary.buffer.toString("hex", 6, 8),
            binary.buffer.toString("hex", 8, 10),
            binary.buffer.toString("hex", 10, 16),
        ].join("-");
    }
    static mapToMongodbDoc(model) {
        const entity = {};
        for (const key in model) {
            const value = model[key];
            if (key === "id") {
                entity["_id"] = MongodbClient.mapUUIDToBinary(value);
            }
            else if (id.test(key)) {
                entity[key] = MongodbClient.mapUUIDToBinary(value);
            }
            else if (value instanceof Buffer) {
                entity[key] = new Binary(value, Binary.SUBTYPE_USER_DEFINED);
            }
            else if (value instanceof Object) {
                entity[key] = MongodbClient.mapToMongodbDoc(value);
            }
            else {
                entity[key] = value;
            }
        }
        return entity;
    }
    static mapFromMongodbDoc(entity) {
        const model = {};
        for (const key in entity) {
            const value = entity[key];
            if (key === "_id") {
                model["id"] = MongodbClient.mapBinaryToUUID(value);
            }
            else if (id.test(key)) {
                model[key] = MongodbClient.mapBinaryToUUID(value);
            }
            else if (value instanceof Object) {
                model[key] = MongodbClient.mapFromMongodbDoc(value);
            }
            else {
                model[key] = value;
            }
        }
        return model;
    }
    async createCollection(name, opts) {
        try {
            await this.db.createCollection(name, {
                validator: opts.schema,
                writeConcern: { w: "majority", wtimeout: 10000, j: true, ...opts.writeConcern },
                readConcern: opts.readConcern || { level: ReadConcern.MAJORITY },
            });
        }
        catch (err) {
            throw mapToDBError(err);
        }
    }
    async findOne(collection, query, opts) {
        try {
            return this.db.collection(collection).findOne(query, opts);
        }
        catch (err) {
            throw mapToDBError(err, collection);
        }
    }
    async insertOne(collection, doc, opts = {}) {
        let resp;
        try {
            resp = await this.db
                .collection(collection)
                .insertOne(doc, opts);
        }
        catch (err) {
            throw mapToDBError(err, collection);
        }
        return resp.insertedId;
    }
    async insertMany(collection, docs, opts = {}) {
        let resp;
        try {
            resp = await this.db
                .collection(collection)
                .insertMany(docs, opts);
        }
        catch (err) {
            throw mapToDBError(err, collection);
        }
        const insertedCount = resp.insertedCount ?? 0;
        if (opts.strict === true && insertedCount !== docs.length) {
            throw new DBOpsError("Not all documents are processed", {
                params: {
                    op: "insertOne",
                    insertedIds: resp.insertedIds
                }
            });
        }
        return Object.values(resp.insertedIds);
    }
    async findOneAndUpdate(collection, filter, update, opts = {}) {
        let resp;
        try {
            resp = await this.db
                .collection(collection)
                .findOneAndUpdate(filter, update, opts);
        }
        catch (err) {
            throw mapToDBError(err);
        }
        if (!resp.ok)
            throw (resp.lastErrorObject ||
                new DBError("findOneAndUpdate failed", {
                    params: { collection, filter }
                }));
        return resp.value;
    }
}
function mapToDBError(err, collection) {
    if (err instanceof MongoError) {
        const message = err.message || err.errmsg;
        const name = err.name;
        const errInfo = err.errInfo;
        const reason = getReason(err);
        const isOpsErr = (err instanceof MongoNetworkError ||
            err instanceof MongoAPIError ||
            err instanceof MongoServerError);
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
    return err;
}
function getReason(err) {
    if (!err.reason)
        return "";
    if (typeof err.reason === "string")
        return err.reason;
    const subErr = err.reason.servers?.values().next().value?.error;
    return JSON.stringify({
        name: err.reason.constructor.name,
        type: err.reason.type,
        subErr: subErr && `${subErr?.message} ${subErr?.name}`
    });
}
//# sourceMappingURL=mongodb.js.map