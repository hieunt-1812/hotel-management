import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('attachments')
@Index('IDX_attachment_owner', ['entityType', 'entityId'])
export class Attachment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  entityType: string;

  @Column('uuid')
  entityId: string;

  @Column()
  url: string;

  @Column()
  fileName: string;

  @Column()
  fileType: string;

  @Column('int')
  fileSize: number;

  @CreateDateColumn()
  createdAt: Date;
}
