import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column()
  password: string;

  @Column()
  fullName: string;

  @Column()
  phone: string;

  @Column({ default: '' })
  bio: string;

  @Column({ default: '' })
  image: string;

  /** Admin lock flag — inactive users cannot log in. */
  @Column({ default: true })
  isActive: boolean;

  /** Set when the user confirms their email; null means not activated yet. */
  @Column({ type: 'timestamp', nullable: true })
  activatedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
