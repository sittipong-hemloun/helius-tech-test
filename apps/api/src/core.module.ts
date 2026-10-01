import { Global, Module, type DynamicModule } from '@nestjs/common';
import { Clock, SystemClock } from './common/clock.js';
import { JsonLogger } from './common/json-logger.js';
import { APP_CONFIG, type AppConfig } from './config/app-config.js';

/** Global singletons: typed config, clock (fake in tests) and the JSON logger. */
@Global()
@Module({})
export class CoreModule {
  static register(config: AppConfig, clock: Clock, logger: JsonLogger): DynamicModule {
    return {
      module: CoreModule,
      providers: [
        { provide: APP_CONFIG, useValue: config },
        { provide: Clock, useValue: clock },
        { provide: JsonLogger, useValue: logger },
      ],
      exports: [APP_CONFIG, Clock, JsonLogger],
    };
  }
}

export { SystemClock };
