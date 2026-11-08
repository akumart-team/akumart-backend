import { HealthCheckService, MemoryHealthIndicator } from '@nestjs/terminus';
export declare class HealthController {
    private readonly health;
    private readonly memory;
    constructor(health: HealthCheckService, memory: MemoryHealthIndicator);
    live(): {
        status: string;
        uptime: number;
    };
    check(): Promise<import("@nestjs/terminus", { with: { "resolution-mode": "import" } }).HealthCheckResult<import("@nestjs/terminus", { with: { "resolution-mode": "import" } }).HealthIndicatorResult<string, import("@nestjs/terminus", { with: { "resolution-mode": "import" } }).HealthIndicatorStatus, Record<string, any>> & import("@nestjs/terminus", { with: { "resolution-mode": "import" } }).HealthIndicatorResult<"memory_heap">, Partial<import("@nestjs/terminus", { with: { "resolution-mode": "import" } }).HealthIndicatorResult<string, import("@nestjs/terminus", { with: { "resolution-mode": "import" } }).HealthIndicatorStatus, Record<string, any>> & import("@nestjs/terminus", { with: { "resolution-mode": "import" } }).HealthIndicatorResult<"memory_heap">> | undefined, Partial<import("@nestjs/terminus", { with: { "resolution-mode": "import" } }).HealthIndicatorResult<string, import("@nestjs/terminus", { with: { "resolution-mode": "import" } }).HealthIndicatorStatus, Record<string, any>> & import("@nestjs/terminus", { with: { "resolution-mode": "import" } }).HealthIndicatorResult<"memory_heap">> | undefined>>;
}
