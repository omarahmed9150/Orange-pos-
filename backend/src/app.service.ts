import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHealth() {
    return {
      status: 'ok',
      service: 'pos-clothing-backend',
      timestamp: new Date().toISOString(),
    };
  }
}
