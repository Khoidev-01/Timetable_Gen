import { Test, TestingModule } from '@nestjs/testing';
import { AlgorithmProducer } from '../worker/algorithm.producer';
import { AlgorithmController } from './algorithm.controller';
import { AlgorithmService } from './algorithm.service';
import { ExportService } from './export.service';
import { BenchmarkService } from './benchmark.service';
import { FeasibilityService } from './feasibility.service';
import { VariantService } from './variant.service';
import { SwapGraphService } from './swap-graph.service';
import { ChangeLogService } from './change-log.service';
import { AnalyticsService } from './analytics.service';
import { PatternMiningService } from './pattern-mining.service';
import { FairnessService } from './fairness.service';

describe('AlgorithmController', () => {
  let controller: AlgorithmController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AlgorithmController],
      providers: [
        { provide: AlgorithmService, useValue: {} },
        { provide: AlgorithmProducer, useValue: {} },
        { provide: ExportService, useValue: {} },
        { provide: FeasibilityService, useValue: {} },
        { provide: BenchmarkService, useValue: {} },
        { provide: VariantService, useValue: {} },
        { provide: SwapGraphService, useValue: {} },
        { provide: ChangeLogService, useValue: {} },
        { provide: AnalyticsService, useValue: {} },
        { provide: PatternMiningService, useValue: {} },
        { provide: FairnessService, useValue: {} },
      ],
    }).compile();

    controller = module.get<AlgorithmController>(AlgorithmController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
