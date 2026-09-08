import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductImageDto } from './dto/update-image.dto';
import { QuickUpdateVariantDto } from './dto/quick-update-variant.dto';

@ApiTags('Products')
@ApiBearerAuth()
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Create a product with variants (يتطلب صلاحية إدارية)' })
  create(@Body() dto: CreateProductDto, @CurrentUser() user: AuthenticatedUser) {
    return this.productsService.create(dto, user.storeId);
  }

  @Get('generate-barcode')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'توليد باركود داخلي فريد لمنتج ليس له باركود من المصنع' })
  async generateBarcode() {
    const barcode = await this.productsService.generateUniqueBarcode();
    return { barcode };
  }

  @Get('import-template')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'تحميل نموذج Excel فارغ بالأعمدة الصحيحة للاستيراد الجماعي' })
  async downloadImportTemplate(@Res() res: Response) {
    const buffer = await this.productsService.generateImportTemplate();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=orange_import_template.xlsx');
    res.send(buffer);
  }

  @Post('import')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'استيراد جماعي للمنتجات من ملف Excel (بنفس أعمدة النموذج)' })
  async importProducts(@UploadedFile() file: Express.Multer.File, @CurrentUser() user: AuthenticatedUser) {
    if (!file) {
      return { imported: 0, skipped: 0, errors: ['لم يتم إرفاق أي ملف'] };
    }
    return this.productsService.importFromExcel(file.buffer, user.userId, user.storeId);
  }

  @Get()
  @ApiOperation({ summary: 'List or search products' })
  @ApiQuery({ name: 'q', required: false, description: 'Search by name, category, SKU, barcode' })
  findAll(@Query('q') query: string | undefined, @CurrentUser() user: AuthenticatedUser) {
    if (query?.trim()) {
      return this.productsService.search(query, user.storeId);
    }
    return this.productsService.findAll(user.storeId);
  }

  @Get('barcode/:barcode')
  @ApiOperation({ summary: 'Find variant by barcode' })
  findByBarcode(@Param('barcode') barcode: string, @CurrentUser() user: AuthenticatedUser) {
    return this.productsService.findByBarcode(barcode, user.storeId);
  }

  @Get('sku/:sku')
  @ApiOperation({ summary: 'Find variant by SKU' })
  findBySku(@Param('sku') sku: string, @CurrentUser() user: AuthenticatedUser) {
    return this.productsService.findBySku(sku, user.storeId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get product by ID' })
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.productsService.findOne(id, user.storeId);
  }

  @Patch(':id/image')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'تحديث أو حذف صورة المنتج' })
  updateImage(@Param('id') id: string, @Body() dto: UpdateProductImageDto, @CurrentUser() user: AuthenticatedUser) {
    return this.productsService.updateImage(id, dto.imageUrl ?? null, user.storeId);
  }

  @Patch('variants/:variantId/quick-update')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'تعديل سريع لسعر البيع أو كمية المخزون' })
  quickUpdateVariant(
    @Param('variantId') variantId: string,
    @Body() dto: QuickUpdateVariantDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.productsService.quickUpdateVariant(variantId, dto, user.userId, user.storeId);
  }
}
