import * as uuid from "uuid";
import * as kMod from "kafkajs";
import {
  BaseService,
  Logger,
  ValidationError
} from "../index.js";

let kafka: kMod.Kafka | void;

export class KafkaProducer {
  constructor(
    public producer: kMod.Producer,
  ) {}

  static async init(opts: {
    config: kMod.KafkaConfig;
    pConfig?: kMod.ProducerConfig;
  }) {
    kafka = (kafka || new kMod.Kafka(opts.config));
    const producer = kafka.producer(opts.pConfig);

    await producer.connect();

    return new this(producer);
  }
}

export class KafkaController {
  constructor(private service: BaseService<never, never>) {}

  async handle(
    { message }: kMod.EachMessagePayload,
    context: { traceId: string, spanId: string }
  ): Promise<void> {
    const body = JSON.parse((message.value || "{}").toString());

    await this.service.run(
      body,
      { context, credentials: { token: "fuck the police" } }
    );
  }

}

export class KafkaClient {
  private topics: string[] = [];
  private routes: Record<string, KafkaController> = {};
  private running = false;

  static async init(logger: Logger, o: {
    config: kMod.KafkaConfig;
    cConfig: kMod.ConsumerConfig;
    pConfig?: kMod.ProducerConfig;
  }) {
    if (!o.config.logCreator) o.config.logCreator = buildKafkaLogger(logger);
    kafka = (kafka || new kMod.Kafka(o.config));
    const consumer = kafka.consumer(o.cConfig);
    const producer = kafka.producer(o.pConfig);
    await Promise.all([
      consumer.connect(),
      producer.connect(),
    ]);

    return new this(consumer, producer, logger);
  }

  constructor(
    private consumer: kMod.Consumer,
    private producer: kMod.Producer,
    private parentLogger: Logger
  ) {}

  add(topic: string, kController: KafkaController) {
    if (this.running) {
      // ?? maybe we can add new topic handler even after we subscribe
      throw Error("router already subscribed to topics and handle them");
    }

    const existingTopic = this.routes[topic];
    if (existingTopic) {
      throw new Error("topic handler already added");
    }
    this.routes[topic] = kController;
    this.topics.push(topic);
  }

  async start(cfg?: Omit<kMod.ConsumerRunConfig, "eachMessage" | "eachBatch">) {
    this.running = true;

    await this.consumer.subscribe({ topics: this.topics });

    await this.consumer.run({
      ...cfg,
      eachMessage: async (payload) => {
        const traceId = payload.message.headers?.traceId?.toString() ?? uuid.v1();
        const spanId = uuid.v1();
        const context = { traceId, spanId };

        const logger = this.parentLogger.clone({ ctx: context });

        const controller = this.routes[payload.topic];
        if (!controller) {
          logger.error("KafkaRouter no controller for a topic", { topic: payload.topic });
          return;
        }

        try {
          await controller.handle(payload, context );
        } catch(err) {
          if (err instanceof ValidationError) {
            const { message, ...rest } = err.valueOf();
            logger.error(message, rest as unknown as Record<string, unknown>);
          }
          throw err;
        }
      }
    });
  }
}

export const buildKafkaLogger = (logger: Logger) => () => {
  return ({ namespace, level, label, log }: kMod.LogEntry) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { message, timestamp, ...rest } = log;

    switch (level) {
      case kMod.logLevel.ERROR:
        return logger.error(message, { label, ...rest, namespace });
      case kMod.logLevel.WARN:
        return logger.verbose(message, { label, ...rest, namespace });
      case kMod.logLevel.INFO:
        return logger.debug(message, { label, ...rest, namespace });
      case kMod.logLevel.DEBUG:
        return logger.debug(message, { label, ...rest, namespace });
    }
  };
};
