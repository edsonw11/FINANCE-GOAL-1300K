import { Module } from '@nestjs/common';
import { WEB_ASSETS, scanWebAssets, webRoot } from './web-assets';
import { WebController } from './web.controller';

@Module({
  controllers: [WebController],
  providers: [{ provide: WEB_ASSETS, useFactory: () => scanWebAssets(webRoot()) }],
})
export class WebModule {}
