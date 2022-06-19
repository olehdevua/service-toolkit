import * as kMod from "kafkajs";
import { Validator } from "../validator.js";

export type KafkaProducerCfg = {
  brokers: string[];
};

export type KafkaConsumerCfg = {
  brokers: string[];
  groupId: string;
};


export class KafkaClient {
  constructor(
    public producer?: kMod.Producer,
    public consumer?: kMod.Consumer
  ) {}

  static async init(opts: {
    config: kMod.KafkaConfig;
    pConfig?: kMod.ProducerConfig;
    cConfig: kMod.ConsumerConfig;
  }) {
    const kafka = new kMod.Kafka(opts.config);

    const producer = kafka.producer(opts.pConfig);
    const consumer = kafka.consumer(opts.cConfig);

    await Promise.all([ producer.connect(), consumer.connect() ]);

    return new KafkaClient(producer, consumer);
  }

  static async initProducer(opts: {
    config: kMod.KafkaConfig;
    pConfig?: kMod.ProducerConfig;
  }) {
    const kafka = new kMod.Kafka(opts.config);
    const producer = kafka.producer(opts.pConfig);

    await producer.connect();

    return new KafkaClient(producer);
  }

  static async initConsumer(opts: {
    config: kMod.KafkaConfig;
    cConfig: kMod.ConsumerConfig;
  }) {
    const kafka = new kMod.Kafka(opts.config);
    const consumer = kafka.consumer(opts.cConfig);
    await consumer.connect();
    return new KafkaClient(undefined, consumer);
  }
}

export class KafkaCfgValidator extends Validator {
  protected checkBrokers(val: unknown, key: string) {
    const brokersStr = this.checkString(val, key);
    if (!brokersStr) return;

    return brokersStr.split(",");
  }

  // TODO: probably add validation `keys` as second parameter
  checkProducerCfg(cfg: Record<string, unknown>) {
    const brokers = this.checkBrokers(cfg.brokers, "KAFKA_BROKERS") as string[];

    return { brokers };
  }

  checkConsumerCfg(cfg: Record<string, unknown>) {
    const brokers = this.checkBrokers(cfg.brokers, "KAFKA_BROKERS") as string[];
    const groupId = this.checkString(cfg.groupId, "KAFKA_GROUP_ID") as string;

    return { brokers, groupId };
  }
}
