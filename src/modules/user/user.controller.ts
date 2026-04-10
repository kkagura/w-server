import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import { UserService } from './user.service';
import type {
  CreateUserDto,
  UpdateUserDto,
  UserQueryDto,
} from './user.service';
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

  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateUserDto,
  ) {
    return toPublicUser(await this.userService.update(id, dto));
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.userService.remove(id);
    return { success: true };
  }
}
