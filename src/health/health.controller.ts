import { Controller, Get } from '@nestjs/common'
import { InjectDataSource } from '@nestjs/typeorm'
import { DataSource } from 'typeorm'

@Controller('health')
export class HealthController {
  constructor(@InjectDataSource() private dataSource: DataSource) {}

  @Get()
  async check() {
    const dbHealthy = await this.checkDatabase()

    return {
      status: dbHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      checks: {
        database: dbHealthy ? 'up' : 'down',
      },
    }
  }

  @Get('live')
  liveness() {
    return { status: 'ok' }
  }

  @Get('ready')
  async readiness() {
    const dbHealthy = await this.checkDatabase()
    if (!dbHealthy) {
      return { status: 'not ready', database: 'down' }
    }
    return { status: 'ready' }
  }

  private async checkDatabase(): Promise<boolean> {
    try {
      // Check if the database connection is established
      return this.dataSource.isInitialized
    } catch {
      return false
    }
  }
}
