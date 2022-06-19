//export type { MongodbClient, MongodbClientOpts } from "./mongodb.js";
//export type { KafkaClient, KafkaConsumerCfg, KafkaProducerCfg, KafkaCfgValidator } from "./kafka.js";
//export type { PostgresCfg, PostgresClient, PostgresCfgValidator } from "./postgres.js";
export * from "./mongodb.js";
export * from "./kafka.js";
export * from "./postgres.js";
export * from "./logger.js";

// export type Clients = {
//   mongodb?: typeof import("./mongodb.js"),
//   kafka?: typeof import("./kafka.js"),
//   postgres?: typeof import("./postgres.js"),
// };
// 
// export async function getClients(): Promise<Clients> {
//   const [ mongodb, kafka, postgres ] = await Promise.allSettled([
//     import("./mongodb.js"),
//     import("./kafka.js"),
//     import("./postgres.js"),
//   ]);
//   
//   const res = {} as Clients;
// 
//   if ("value" in mongodb) res.mongodb = mongodb.value;
//   if ("value" in kafka) res.kafka = kafka.value;
//   if ("value" in postgres) res.postgres = postgres.value;
// 
//   return res;
// }
