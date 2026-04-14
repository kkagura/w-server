import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import { UserService } from './user.service';
import type { CreateUserDto, UserQueryDto } from './user.service';
import { toPublicUser, toPublicUsers } from './user.presenter';

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  async create(@Body() dto: CreateUserDto) {
    return toPublicUser(await this.userService.create(dto));
  }

  @Get()
  async findAll(@Query() query: UserQueryDto) {
    return toPublicUsers(await this.userService.findAll(query));
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return toPublicUser(await this.userService.findOne(id));
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.userService.remove(id);
    return { success: true };
  }
}
