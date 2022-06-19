import * as kMod from "kafkajs";
import { Validator } from "../validator.js";
export declare type KafkaProducerCfg = {
    brokers: string[];
};
export declare type KafkaConsumerCfg = {
    brokers: string[];
    groupId: string;
};
export declare class KafkaClient {
    producer?: kMod.Producer | undefined;
    consumer?: kMod.Consumer | undefined;
    constructor(producer?: kMod.Producer | undefined, consumer?: kMod.Consumer | undefined);
    static init(opts: {
        config: kMod.KafkaConfig;
        pConfig?: kMod.ProducerConfig;
        cConfig: kMod.ConsumerConfig;
    }): Promise<KafkaClient>;
    static initProducer(opts: {
        config: kMod.KafkaConfig;
        pConfig?: kMod.ProducerConfig;
    }): Promise<KafkaClient>;
    static initConsumer(opts: {
        config: kMod.KafkaConfig;
        cConfig: kMod.ConsumerConfig;
    }): Promise<KafkaClient>;
}
export declare class KafkaCfgValidator extends Validator {
    protected checkBrokers(val: unknown, key: string): string[] | undefined;
    checkProducerCfg(cfg: Record<string, unknown>): {
        brokers: string[];
    };
    checkConsumerCfg(cfg: Record<string, unknown>): {
        brokers: string[];
        groupId: string;
    };
}
//# sourceMappingURL=kafka.d.ts.map