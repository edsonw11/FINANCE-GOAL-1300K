import { readFile } from 'node:fs/promises';
import { Controller, Get, Inject, NotFoundException, Req, Res } from '@nestjs/common';
import { type FastifyReply, type FastifyRequest } from 'fastify';
import { Public } from '../auth/public.decorator';
import { WEB_ASSETS, type WebAsset } from './web-assets';
import { SkipRateLimit } from '../security/rate-limit.decorator';

/** The browser app, served by the API so that app and API share one origin (cookies stay first-party and no CORS is needed). */
@Public()
@SkipRateLimit()
@Controller()
export class WebController {
  constructor(@Inject(WEB_ASSETS) private readonly assets: ReadonlyMap<string, WebAsset>) {}

  @Get()
  index(@Req() request: FastifyRequest, @Res() reply: FastifyReply): Promise<void> {
    return this.send(request, reply);
  }

  @Get('index.html')
  indexHtml(@Req() request: FastifyRequest, @Res() reply: FastifyReply): Promise<void> {
    return this.send(request, reply);
  }

  @Get('src/*')
  src(@Req() request: FastifyRequest, @Res() reply: FastifyReply): Promise<void> {
    return this.send(request, reply);
  }

  @Get('vendor/*')
  vendor(@Req() request: FastifyRequest, @Res() reply: FastifyReply): Promise<void> {
    return this.send(request, reply);
  }

  private async send(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const path = request.url.split('?')[0]!;
    const asset = this.assets.get(path);
    if (!asset) throw new NotFoundException();
    const body = await readFile(asset.file);
    // the page carries the policy that lets only its own files and its own inline script run
    if (asset.csp) void reply.header('content-security-policy', asset.csp);
    void reply.header('content-type', asset.type).header('x-content-type-options', 'nosniff').header('referrer-policy', 'same-origin').send(body);
  }
}
