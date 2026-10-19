import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { UsersService } from './users.service';
import { AdminListUsersQueryDto } from './dto/admin-list-users-query.dto';
import { toPaginatedResult } from '../common/utils/paginate.util';

@Injectable()
export class AdminUsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly usersService: UsersService,
  ) {}

  async findAll({
    keyword,
    role,
    isActive,
    page,
    limit,
  }: AdminListUsersQueryDto) {
    const qb = this.usersRepository
      .createQueryBuilder('user')
      .orderBy('user.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (keyword) {
      qb.andWhere('(user.email ILIKE :kw OR user.fullName ILIKE :kw)', {
        kw: `%${this.escapeLike(keyword)}%`,
      });
    }
    if (role) qb.andWhere('user.role = :role', { role });
    if (isActive !== undefined) {
      qb.andWhere('user.isActive = :isActive', { isActive });
    }

    const [users, total] = await qb.getManyAndCount();
    return toPaginatedResult(
      [users.map((u) => this.usersService.toSafeUser(u)), total],
      page,
      limit,
    );
  }

  async findOne(id: string) {
    const user = await this.usersService.findById(id);
    if (!user) throw new NotFoundException('Không tìm thấy người dùng');
    return this.usersService.toSafeUser(user);
  }

  async updateStatus(id: string, isActive: boolean, currentAdminId: string) {
    if (id === currentAdminId && !isActive) {
      throw new BadRequestException(
        'Không thể tự khoá tài khoản của chính mình',
      );
    }
    const user = await this.usersService.findById(id);
    if (!user) throw new NotFoundException('Không tìm thấy người dùng');

    user.isActive = isActive;
    return this.usersService.toSafeUser(await this.usersRepository.save(user));
  }

  /** Treat user-typed % and _ literally inside ILIKE. */
  private escapeLike(value: string) {
    return value.replace(/[\\%_]/g, (char) => `\\${char}`);
  }
}
