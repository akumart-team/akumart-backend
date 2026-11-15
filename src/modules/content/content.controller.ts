import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  Authenticated,
  Staff,
  type AuthRequest,
} from '../../common/platform/api';
import { PageQuery } from '../../common/platform/query.dto';
import { ContentService } from './content.service';
import {
  ArticleDto,
  UpdateArticleDto,
  NewsDto,
  NewsDecisionDto,
} from './dto/content.dto';
@ApiTags('Articles and news')
@Controller({ version: '1' })
export class ContentController {
  constructor(private readonly service: ContentService) {}
  @Get('articles') articles(@Query() q: PageQuery) {
    return this.service.articles(q);
  }
  @Get('articles/:slug') article(@Param('slug') slug: string) {
    return this.service.article(slug);
  }
  @Get('news') news(@Query() q: PageQuery) {
    return this.service.news(q);
  }
  @Get('users/me/saved-articles') @Authenticated() saved(
    @Req() r: AuthRequest,
    @Query() q: PageQuery,
  ) {
    return this.service.saved(r.user.id, q);
  }
  @Put('users/me/saved-articles/:id') @Authenticated() save(
    @Req() r: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.bookmark(r.user.id, id);
  }
  @Delete('users/me/saved-articles/:id') @Authenticated() unsave(
    @Req() r: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.bookmark(r.user.id, id, true);
  }
  @Get('admin/articles') @Staff('content') admin(@Query() q: PageQuery) {
    return this.service.articles(q, true);
  }
  @Get('admin/articles/:slug') @Staff('content') adminArticle(
    @Param('slug') slug: string,
  ) {
    return this.service.article(slug, true);
  }
  @Post('admin/articles') @Staff('content') create(
    @Req() r: AuthRequest,
    @Body() dto: ArticleDto,
  ) {
    return this.service.save(r.user.id, dto);
  }
  @Patch('admin/articles/:id') @Staff('content') edit(
    @Req() r: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateArticleDto,
  ) {
    return this.service.save(r.user.id, dto, id);
  }
  @Get('admin/news') @Staff('content') adminNews(@Query() q: PageQuery) {
    return this.service.news(q, true);
  }
  @Post('admin/news') @Staff('content') propose(
    @Req() r: AuthRequest,
    @Body() dto: NewsDto,
  ) {
    return this.service.propose(r.user.id, dto);
  }
  @Patch('admin/news/:id') @Staff('content') decide(
    @Req() r: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: NewsDecisionDto,
  ) {
    return this.service.decide(r.user.id, id, dto.status);
  }
}
