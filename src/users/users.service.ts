import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, QueryFailedError, Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { AttachmentsService } from '../attachments/attachments.service';
import * as bcrypt from 'bcrypt';

const PG_UNIQUE_VIOLATION = '23505';
const EMAIL_EXISTS_MESSAGE = 'Email đã tồn tại';

export type SafeUser = Omit<User, 'password'>;

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly attachmentsService: AttachmentsService,
  ) {}

  /** Creates a not-yet-activated user. */
  async create(createUserDto: CreateUserDto): Promise<SafeUser> {
    const { email, password, fullName, phone } = createUserDto;

    if (await this.findByEmail(email)) {
      throw new ConflictException(EMAIL_EXISTS_MESSAGE);
    }

    const newUser = this.usersRepository.create({
      email,
      fullName,
      phone,
      password: await this.hashPassword(password),
    });

    try {
      return this.toSafeUser(await this.usersRepository.save(newUser));
    } catch (error) {
      // Concurrent registration with the same email slipped past the check above
      if (
        error instanceof QueryFailedError &&
        (error.driverError as { code?: string })?.code === PG_UNIQUE_VIOLATION
      ) {
        throw new ConflictException(EMAIL_EXISTS_MESSAGE);
      }
      throw error;
    }
  }

  async update(
    userId: string,
    updateUserDto: UpdateUserDto,
    avatar?: Express.Multer.File,
  ) {
    const user = await this.findById(userId);
    if (!user) {
      throw new NotFoundException('Không tìm thấy người dùng');
    }

    const { email, password, fullName, phone } = updateUserDto;

    if (email && email !== user.email) {
      await this.ensureUniqueEmail(email, userId);
      user.email = email;
    }

    if (fullName !== undefined) user.fullName = fullName;
    if (phone !== undefined) user.phone = phone;

    if (avatar) {
      const attachment = await this.attachmentsService.createForEntity(
        'user',
        user.id,
        avatar,
      );
      user.avatar = attachment.url;
    }

    if (password) {
      user.password = await this.hashPassword(password);
    }

    const savedUser = await this.usersRepository.save(user);
    return { user: this.toSafeUser(savedUser) };
  }

  /** Marks the user as activated. Idempotent: keeps the first activation time. */
  async activate(userId: string): Promise<boolean> {
    const user = await this.findById(userId);
    if (!user) return false;
    if (!user.activatedAt) {
      // DB clock (like createdAt) — a JS Date would be stored in server local time
      await this.usersRepository.update(user.id, {
        activatedAt: () => 'now()',
      });
    }
    return true;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { email } });
  }

  async findById(id: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { id } });
  }

  toSafeUser(user: User): SafeUser {
    const { password: _, ...safeUser } = user;
    return safeUser;
  }

  private async hashPassword(password: string): Promise<string> {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(password, salt);
  }

  private async ensureUniqueEmail(email: string, excludeUserId: string) {
    const conflict = await this.usersRepository.findOne({
      where: { email, id: Not(excludeUserId) },
    });
    if (conflict) {
      throw new ConflictException(EMAIL_EXISTS_MESSAGE);
    }
  }
}
