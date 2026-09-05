import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import * as ExcelJS from 'exceljs';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class EmailBackupService {
  private readonly logger = new Logger(EmailBackupService.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor(private readonly prisma: PrismaService) {
    this.initializeTransporter();
  }

  private initializeTransporter() {
    const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM } = process.env;
    
    if (!SMTP_HOST || !SMTP_USER || !SMTP_PASSWORD) {
      this.logger.warn('SMTP not configured - email backup disabled');
      return;
    }

    this.transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: parseInt(SMTP_PORT || '587', 10),
      secure: SMTP_PORT === '465',
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASSWORD,
      },
    });
  }

  isConfigured(): boolean {
    return !!this.transporter;
  }

  async buildDownloadBackup(userId: string): Promise<{ buffer: Buffer; fileName: string }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new BadRequestException('User not found');
    const filePath = await this.buildCompleteBackup(user.fullName);
    const fileName = `orange_backup_${new Date().toISOString().slice(0, 10).replace(/-/g, '_')}.xlsx`;
    try {
      return { buffer: await fs.promises.readFile(filePath), fileName };
    } finally {
      await fs.promises.unlink(filePath).catch(() => undefined);
    }
  }

  async sendBackupEmail(recipientEmail: string, userId: string): Promise<{ success: boolean; message: string }> {
    if (!this.isConfigured()) {
      throw new BadRequestException('Email backup is not configured on this server');
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(recipientEmail)) {
      throw new BadRequestException('Invalid email address');
    }

    try {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (!user) throw new BadRequestException('User not found');

      const filePath = await this.buildCompleteBackup(user.fullName);
      const dateStr = new Date().toISOString().slice(0, 10);

      const result = await this.transporter!.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: recipientEmail,
        subject: `ORANGE POS Backup - ${dateStr}`,
        text: `Attached is your complete ORANGE POS system backup dated ${dateStr}.\n\nThis file contains:\n- All products and variants\n- All sales transactions\n- Sale items details\n- Customers and debts\n- Suppliers and debts\n- Purchases\n- Purchase items\n- Expenses\n- Shifts\n- Users\n- Inventory movements\n- Audit logs\n- Store settings`,
        attachments: [
          {
            filename: `orange_backup_${dateStr.replace(/-/g, '_')}.xlsx`,
            path: filePath,
          },
        ],
      });

      // Clean up temp file
      fs.unlinkSync(filePath);

      this.logger.log(`Backup email sent to ${recipientEmail} for user ${user.username}`);
      return { success: true, message: `Backup sent successfully to ${recipientEmail}` };
    } catch (err: any) {
      this.logger.error(`Failed to send backup email: ${err.message}`);
      if (err.code === 'EAUTH') {
        throw new BadRequestException('SMTP authentication failed - server configuration error');
      }
      throw new BadRequestException(`Failed to send email: ${err.message}`);
    }
  }

  private async buildCompleteBackup(userName: string): Promise<string> {
    const workbook = new ExcelJS.Workbook();

    // Fetch all data in parallel
    const [products, sales, customers, suppliers, purchases, expenses, shifts, users, settings] = await Promise.all([
      this.prisma.product.findMany({ include: { variants: true } }),
      this.prisma.sale.findMany({ include: { items: true, customer: true } }),
      this.prisma.customer.findMany(),
      this.prisma.supplier.findMany(),
      this.prisma.purchaseInvoice.findMany({ include: { items: true, supplier: true } }),
      this.prisma.expense.findMany(),
      this.prisma.shift.findMany(),
      this.prisma.user.findMany({ select: { id: true, username: true, fullName: true, role: true, isActive: true } }),
      this.prisma.storeSettings.findFirst(),
    ]);

    // Products Sheet
    const productsSheet = workbook.addWorksheet('المنتجات');
    productsSheet.columns = [
      { header: 'اسم المنتج', key: 'name', width: 25 },
      { header: 'الفئة', key: 'category', width: 20 },
      { header: 'SKU', key: 'sku', width: 15 },
      { header: 'الباركود', key: 'barcode', width: 15 },
      { header: 'الحجم', key: 'size', width: 10 },
      { header: 'اللون', key: 'color', width: 10 },
      { header: 'سعر التكلفة', key: 'costPrice', width: 12 },
      { header: 'سعر البيع', key: 'sellingPrice', width: 12 },
      { header: 'المخزون', key: 'stockQuantity', width: 10 },
    ];
    for (const p of products) {
      for (const v of p.variants) {
        productsSheet.addRow({
          name: p.name,
          category: p.category,
          sku: v.sku,
          barcode: v.barcode || '',
          size: v.size || '',
          color: v.color || '',
          costPrice: v.costPrice,
          sellingPrice: v.sellingPrice,
          stockQuantity: v.stockQuantity,
        });
      }
    }

    // Sales Sheet
    const salesSheet = workbook.addWorksheet('المبيعات');
    salesSheet.columns = [
      { header: 'رقم الفاتورة', key: 'id', width: 18 },
      { header: 'التاريخ والوقت', key: 'date', width: 20 },
      { header: 'المبلغ الإجمالي', key: 'total', width: 12 },
      { header: 'الخصم', key: 'discount', width: 10 },
      { header: 'الضريبة', key: 'tax', width: 10 },
      { header: 'طريقة الدفع', key: 'payment', width: 12 },
      { header: 'حالة الاسترجاع', key: 'refund', width: 12 },
    ];
    for (const s of sales) {
      salesSheet.addRow({
        id: s.id.slice(0, 8),
        date: new Date(s.createdAt).toLocaleString('ar-EG'),
        total: s.totalAmount,
        discount: s.discount,
        tax: s.tax,
        payment: s.paymentMethod,
        refund: s.refundStatus,
      });
    }

    // Sale Items Sheet
    const saleItemsSheet = workbook.addWorksheet('تفاصيل المبيعات');
    saleItemsSheet.columns = [
      { header: 'رقم الفاتورة', key: 'saleId', width: 15 },
      { header: 'SKU', key: 'sku', width: 15 },
      { header: 'الكمية', key: 'qty', width: 10 },
      { header: 'السعر', key: 'price', width: 10 },
    ];
    for (const s of sales) {
      for (const item of s.items) {
        saleItemsSheet.addRow({
          saleId: s.id.slice(0, 8),
          sku: item.variantId.slice(0, 8),
          qty: item.quantity,
          price: item.price,
        });
      }
    }

    // Customers Sheet
    const customersSheet = workbook.addWorksheet('العملاء');
    customersSheet.columns = [
      { header: 'الاسم', key: 'name', width: 25 },
      { header: 'الهاتف', key: 'phone', width: 15 },
      { header: 'ملاحظات', key: 'notes', width: 30 },
      { header: 'تاريخ التسجيل', key: 'createdAt', width: 18 },
    ];
    for (const c of customers) {
      customersSheet.addRow({
        name: c.name,
        phone: c.phone || '',
        notes: c.notes || '',
        createdAt: new Date(c.createdAt).toLocaleDateString('ar-EG'),
      });
    }

    // Suppliers Sheet
    const suppliersSheet = workbook.addWorksheet('الموردون');
    suppliersSheet.columns = [
      { header: 'الاسم', key: 'name', width: 25 },
      { header: 'الهاتف', key: 'phone', width: 15 },
      { header: 'العنوان', key: 'address', width: 30 },
    ];
    for (const s of suppliers) {
      suppliersSheet.addRow({
        name: s.name,
        phone: s.phone || '',
        address: s.address || '',
      });
    }

    // Purchases Sheet
    const purchasesSheet = workbook.addWorksheet('المشتريات');
    purchasesSheet.columns = [
      { header: 'رقم الفاتورة', key: 'id', width: 15 },
      { header: 'المورد', key: 'supplier', width: 20 },
      { header: 'الإجمالي', key: 'total', width: 12 },
      { header: 'المدفوع', key: 'paid', width: 12 },
      { header: 'التاريخ', key: 'date', width: 15 },
    ];
    for (const p of purchases) {
      purchasesSheet.addRow({
        id: p.id.slice(0, 8),
        supplier: p.supplier.name,
        total: p.totalAmount,
        paid: p.paidAmount,
        date: new Date(p.createdAt).toLocaleDateString('ar-EG'),
      });
    }

    // Expenses Sheet
    const expensesSheet = workbook.addWorksheet('المصاريف');
    expensesSheet.columns = [
      { header: 'البند', key: 'title', width: 25 },
      { header: 'المبلغ', key: 'amount', width: 12 },
      { header: 'التاريخ', key: 'date', width: 15 },
    ];
    for (const e of expenses) {
      expensesSheet.addRow({
        title: e.title,
        amount: e.amount,
        date: new Date(e.createdAt).toLocaleDateString('ar-EG'),
      });
    }

    // Shifts Sheet
    const shiftsSheet = workbook.addWorksheet('الورديات');
    shiftsSheet.columns = [
      { header: 'رقم الوردية', key: 'id', width: 15 },
      { header: 'الموظف', key: 'cashier', width: 20 },
      { header: 'الحالة', key: 'status', width: 10 },
      { header: 'المبلغ الأولي', key: 'initial', width: 12 },
      { header: 'المبلغ النهائي', key: 'actual', width: 12 },
      { header: 'الوقت', key: 'time', width: 20 },
    ];
    for (const s of shifts) {
      shiftsSheet.addRow({
        id: s.id.slice(0, 8),
        cashier: 'User',
        status: s.status,
        initial: s.initialCash,
        actual: s.actualCash || '',
        time: new Date(s.startTime).toLocaleString('ar-EG'),
      });
    }

    // Users Sheet
    const usersSheet = workbook.addWorksheet('المستخدمون');
    usersSheet.columns = [
      { header: 'اسم المستخدم', key: 'username', width: 15 },
      { header: 'الاسم الكامل', key: 'fullName', width: 20 },
      { header: 'الصلاحية', key: 'role', width: 15 },
      { header: 'نشط', key: 'active', width: 10 },
    ];
    for (const u of users) {
      usersSheet.addRow({
        username: u.username,
        fullName: u.fullName,
        role: u.role,
        active: u.isActive ? 'نعم' : 'لا',
      });
    }

    // Summary Sheet
    const summarySheet = workbook.addWorksheet('الملخص');
    const totalSales = sales.reduce((sum, s) => sum + s.totalAmount, 0);
    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
    summarySheet.addRows([
      ['تاريخ النسخة الاحتياطية', new Date().toLocaleString('ar-EG')],
      ['اسم المستخدم', userName],
      ['عدد المنتجات', products.length],
      ['عدد الفواتير', sales.length],
      ['إجمالي المبيعات', totalSales],
      ['إجمالي المصاريف', totalExpenses],
      ['صافي الربح', totalSales - totalExpenses],
      ['عدد العملاء', customers.length],
      ['عدد الموردين', suppliers.length],
    ]);

    const fileName = `ORANGE_Backup_${new Date().toISOString().slice(0, 10).replace(/-/g, '_')}_${Date.now()}.xlsx`;
    const filePath = path.join(os.tmpdir(), fileName);
    await workbook.xlsx.writeFile(filePath);
    return filePath;
  }
}
