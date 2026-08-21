import { Controller, Get } from "@nestjs/common";
import type { HealthCheckResult } from "@traveltok/types";
import { Public } from "../common/decorators/public.decorator";
import { HealthService } from "./health.service";

@Controller("health")
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Public()
  @Get()
  check(): Promise<HealthCheckResult> {
    return this.healthService.check();
  }
}
