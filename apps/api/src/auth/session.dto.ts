import { ApiProperty } from '@nestjs/swagger';

class SessionUserDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty() email: string;
  @ApiProperty() displayName: string;
  @ApiProperty({ enum: ['ADMIN', 'VIEWER'] }) role: 'ADMIN' | 'VIEWER';
}

class PermissionsDto {
  @ApiProperty() canWriteEmployees: boolean;
  @ApiProperty() canViewSalary: boolean;
  @ApiProperty() canGenerateReports: boolean;
  @ApiProperty() canViewIntegrations: boolean;
}

/** PRD §10.6 SessionData. Permissions only drive the UI; the API re-checks every request. */
export class SessionDataDto {
  @ApiProperty({ type: SessionUserDto }) user: SessionUserDto;
  @ApiProperty({ type: PermissionsDto }) permissions: PermissionsDto;
  @ApiProperty() csrfToken: string;
  @ApiProperty({ format: 'date-time' }) absoluteExpiresAt: string;
}
