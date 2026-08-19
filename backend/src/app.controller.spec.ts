import { Test } from '@nestjs/testing';
import { AppController } from './app.controller';

describe('AppController', () => {
  it('returns the application status', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AppController],
    }).compile();

    expect(moduleRef.get(AppController).getStatus()).toEqual({ status: 'ok' });
  });
});
