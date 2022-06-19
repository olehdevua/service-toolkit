import * as kMod from "kafkajs";
import { Validator } from "../validator.js";
export class KafkaClient {
    producer;
    consumer;
    constructor(producer, consumer) {
        this.producer = producer;
        this.consumer = consumer;
    }
    static async init(opts) {
        const kafka = new kMod.Kafka(opts.config);
        const producer = kafka.producer(opts.pConfig);
        const consumer = kafka.consumer(opts.cConfig);
        await Promise.all([producer.connect(), consumer.connect()]);
        return new KafkaClient(producer, consumer);
    }
    static async initProducer(opts) {
        const kafka = new kMod.Kafka(opts.config);
        const producer = kafka.producer(opts.pConfig);
        await producer.connect();
        return new KafkaClient(producer);
    }
    static async initConsumer(opts) {
        const kafka = new kMod.Kafka(opts.config);
        const consumer = kafka.consumer(opts.cConfig);
        await consumer.connect();
        return new KafkaClient(undefined, consumer);
    }
}
export class KafkaCfgValidator extends Validator {
    checkBrokers(val, key) {
        const brokersStr = this.checkString(val, key);
        if (!brokersStr)
            return;
        return brokersStr.split(",");
    }
    checkProducerCfg(cfg) {
        const brokers = this.checkBrokers(cfg.brokers, "KAFKA_BROKERS");
        return { brokers };
    }
    checkConsumerCfg(cfg) {
        const brokers = this.checkBrokers(cfg.brokers, "KAFKA_BROKERS");
        const groupId = this.checkString(cfg.groupId, "KAFKA_GROUP_ID");
        return { brokers, groupId };
    }
}
//# sourceMappingURL=kafka.js.map