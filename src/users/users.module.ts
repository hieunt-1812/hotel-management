import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { ProfileController } from './profile.controller';
import { AdminUsersController } from './admin-users.controller';
import { AdminUsersService } from './admin-users.service';
import { User } from './entities/user.entity';
import { AttachmentsModule } from '../attachments/attachments.module';
import { RefreshTokenModule } from '../auth/refresh-token.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    AttachmentsModule,
    RefreshTokenModule,
  ],
  controllers: [ProfileController, AdminUsersController],
  providers: [UsersService, AdminUsersService],
  exports: [UsersService],
})
export class UsersModule {}
