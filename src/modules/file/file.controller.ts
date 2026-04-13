import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import type { QueryFileDto } from './dto/query-file.dto';
import type { UploadFileDto, UploadedFilePayload } from './dto/upload-file.dto';
import { FileService } from './file.service';

@Controller('files')
export class FileController {
  constructor(private readonly fileService: FileService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  upload(
    @UploadedFile() file: UploadedFilePayload | undefined,
    @Body() dto: UploadFileDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.fileService.upload(file, dto, currentUser);
  }

  @Get()
  findAll(@Query() query: QueryFileDto) {
    return this.fileService.findAll(query);
  }

  @Get(':id/content')
  async getContent(
    @Param('id', ParseIntPipe) id: number,
    @Query('mode') mode: string | undefined,
    @Res() response: Response,
  ) {
    await this.fileService.writeContentToResponse(id, mode, response);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.fileService.findOne(id);
  }

  @Delete(':id')
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    await this.fileService.delete(id, currentUser);

    return { success: true };
  }
}
