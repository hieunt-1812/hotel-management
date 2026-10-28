import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { ReviewStatus } from '../entities/review.entity';

export class AdminListReviewsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ReviewStatus })
  @IsOptional()
  @IsEnum(ReviewStatus)
  status?: ReviewStatus;
}
