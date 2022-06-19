import { MongoClient, MongoClientOptions, Binary, ObjectId, Db, WriteConcernSettings, ReadConcern } from "mongodb";
export declare type MongodbClientOpts = MongoClientOptions;
export declare class MongodbClient {
    client: MongoClient;
    db: Db;
    constructor(client: MongoClient, db: Db);
    static init(url: string, opts: MongodbClientOpts): Promise<MongodbClient>;
    static generateUUID(): Binary;
    static mapUUIDToBinary(uuid: string): Binary;
    static mapBinaryToUUID(binary: Binary): string;
    static mapToMongodbDoc(model: Record<string, any>): Record<string, unknown>;
    static mapFromMongodbDoc(entity: Record<string, any>): Record<string, unknown>;
    createCollection(name: string, opts: {
        schema: Record<string, unknown>;
        writeConcern?: WriteConcernSettings;
        readConcern?: ReadConcern;
    }): Promise<void>;
    findOne(collection: string, query: Record<string, unknown>, opts: Record<string, unknown>): Promise<Record<string, unknown> | null>;
    insertOne(collection: string, doc: Record<string, unknown>, opts?: Record<string, unknown>): Promise<ObjectId>;
    insertMany(collection: string, docs: Record<string, unknown>[], opts?: Record<string, unknown>): Promise<ObjectId[]>;
    findOneAndUpdate(collection: string, filter: Record<string, unknown>, update: Record<string, unknown>, opts?: Record<string, unknown>): Promise<Record<string, unknown> | null>;
}
//# sourceMappingURL=mongodb.d.ts.map