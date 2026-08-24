import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { StatusResponseDto } from './openapi/response.dto';

@ApiTags('health')
@Controller()
export class AppController {
  @ApiOperation({ summary: 'Check whether the API is running' })
  @ApiOkResponse({ type: StatusResponseDto })
  @Get()
  getStatus(): { status: string } {
    return { status: 'ok' };
  }
}
