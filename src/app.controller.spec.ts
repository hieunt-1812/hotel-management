import { Test, TestingModule } from '@nestjs/testing';
import { I18nService } from 'nestjs-i18n';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;
  const i18nMock = { t: jest.fn().mockReturnValue('Hello World!') };

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService, { provide: I18nService, useValue: i18nMock }],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return the translated "common.HELLO" message', () => {
      expect(appController.getHello()).toBe('Hello World!');
      expect(i18nMock.t).toHaveBeenCalledWith(
        'common.HELLO',
        expect.any(Object),
      );
    });
  });
});
