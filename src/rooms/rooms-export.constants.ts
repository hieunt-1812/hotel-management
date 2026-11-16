import { BedType, RoomView } from './entities/room.entity';

export const XLSX_MIME_TYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export const ROOMS_EXPORT_SHEET_NAME = 'Danh sách phòng';

export const roomsExportFileName = (date: string) => `rooms-${date}.xlsx`;

export const ROOMS_EXPORT_COLUMNS = [
  { header: 'STT', key: 'index', width: 6 },
  { header: 'Tên phòng', key: 'name', width: 20 },
  { header: 'Loại phòng', key: 'roomType', width: 16 },
  {
    header: 'Giá / đêm (VND)',
    key: 'pricePerNight',
    width: 16,
    style: { numFmt: '#,##0' },
  },
  { header: 'Sức chứa', key: 'capacity', width: 10 },
  { header: 'Loại giường', key: 'bedType', width: 14 },
  { header: 'View', key: 'view', width: 12 },
  { header: 'Tiện nghi', key: 'amenities', width: 36 },
  { header: 'Mô tả', key: 'description', width: 40 },
  { header: 'Ngày tạo', key: 'createdAt', width: 18 },
];

export const BED_TYPE_LABELS: Record<BedType, string> = {
  [BedType.SINGLE]: 'Giường đơn',
  [BedType.DOUBLE]: 'Giường đôi',
};

export const ROOM_VIEW_LABELS: Record<RoomView, string> = {
  [RoomView.SEA]: 'Biển',
  [RoomView.CITY]: 'Thành phố',
  [RoomView.GARDEN]: 'Vườn',
};
