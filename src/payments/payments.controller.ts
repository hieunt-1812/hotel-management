import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from './dto/create-payment.dto';

@ApiTags('Payments')
@ApiBearerAuth()
@ApiResponse({ status: 401, description: 'Chưa đăng nhập.' })
@Controller('bookings')
@UseGuards(AuthGuard('jwt'))
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post(':id/payments')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Thanh toán booking đã duyệt của mình' })
  @ApiResponse({ status: 201, description: 'Thanh toán thành công.' })
  @ApiResponse({ status: 403, description: 'Không phải booking của bạn.' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy booking.' })
  @ApiResponse({
    status: 409,
    description: 'Booking chưa được duyệt hoặc đã thanh toán.',
  })
  pay(
    @Request() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() { method }: CreatePaymentDto,
  ) {
    return this.paymentsService.pay(req.user.id, id, method);
  }
}
