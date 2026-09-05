import sqlite3
from datetime import datetime

DB_NAME = "pos_database.db"

def get_connection():
    """إنشاء اتصال مباشر وسريع مع قاعدة البيانات"""
    conn = sqlite3.connect(DB_NAME, timeout=10)
    conn.row_factory = sqlite3.Row
    # تفعيل قيود المفاتيح الأجنبية (FOREIGN KEY) لأن SQLite يعطلها افتراضياً،
    # وبدونها فإن ON DELETE CASCADE المعرّفة في الجداول لن تُطبَّق فعلياً
    conn.execute("PRAGMA foreign_keys = ON")
    return conn

def init_db():
    """تهيئة قاعدة البيانات والجداول"""
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            full_name TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'cashier'
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            barcode TEXT UNIQUE,
            quantity INTEGER NOT NULL DEFAULT 0,
            cost_price REAL NOT NULL DEFAULT 0.0,
            selling_price REAL NOT NULL DEFAULT 0.0
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS sales (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            invoice_number TEXT NOT NULL,
            cashier_username TEXT NOT NULL,
            customer_name TEXT,
            payment_type TEXT NOT NULL,
            total_amount REAL NOT NULL,
            discount REAL DEFAULT 0.0,
            final_amount REAL NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS sale_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sale_id INTEGER NOT NULL,
            product_id INTEGER,
            product_name TEXT NOT NULL,
            quantity INTEGER NOT NULL,
            cost_price REAL NOT NULL,
            selling_price REAL NOT NULL,
            subtotal REAL NOT NULL,
            FOREIGN KEY (sale_id) REFERENCES sales (id) ON DELETE CASCADE
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS debts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            customer_name TEXT NOT NULL,
            phone TEXT,
            amount REAL NOT NULL,
            paid_amount REAL DEFAULT 0.0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS debt_payments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            debt_id INTEGER NOT NULL,
            amount_paid REAL NOT NULL,
            note TEXT,
            payment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (debt_id) REFERENCES debts (id) ON DELETE CASCADE
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS product_returns (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            product_id INTEGER NOT NULL,
            product_name TEXT NOT NULL,
            quantity INTEGER NOT NULL,
            refund_amount REAL NOT NULL,
            cashier_username TEXT NOT NULL,
            reason TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # إدراج المدير الافتراضي
    cursor.execute("SELECT COUNT(*) FROM users")
    if cursor.fetchone()[0] == 0:
        cursor.execute("""
            INSERT INTO users (username, password, full_name, role)
            VALUES ('admin', '123', 'المدير العام', 'admin')
        """)

    conn.commit()
    conn.close()

# ==================== 👤 إدارة المستخدمين ====================
def authenticate_user(username, password):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE username = ? AND password = ?", (username, password))
    user = cursor.fetchone()
    conn.close()
    return dict(user) if user else None

def get_all_users():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, username, full_name, role FROM users")
    users = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return users

def add_user(username, password, full_name, role):
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("INSERT INTO users (username, password, full_name, role) VALUES (?, ?, ?, ?)",
                       (username, password, full_name, role))
        conn.commit()
        return True, "تمت إضافة المستخدم بنجاح!"
    except sqlite3.IntegrityError:
        return False, "اسم المستخدم موجود مسبقاً!"
    except Exception as e:
        return False, str(e)
    finally:
        conn.close()

def delete_user(user_id):
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("DELETE FROM users WHERE id = ?", (user_id,))
        conn.commit()
        return True, "تم حذف المستخدم بنجاح!"
    except Exception as e:
        return False, str(e)
    finally:
        conn.close()

# ==================== 📦 إدارة المنتجات وتحديث المخزون ====================
def get_inventory():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM products ORDER BY id DESC")
    products = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return products

def search_inventory(query):
    conn = get_connection()
    cursor = conn.cursor()
    q = f"%{query}%"
    cursor.execute("SELECT * FROM products WHERE name LIKE ? OR barcode LIKE ? ORDER BY id DESC", (q, q))
    products = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return products

def add_or_update_product(name, barcode, quantity, cost_price, selling_price):
    conn = get_connection()
    cursor = conn.cursor()

    clean_barcode = barcode.strip() if barcode and str(barcode).strip() else None

    try:
        if clean_barcode:
            cursor.execute("SELECT id, quantity FROM products WHERE barcode = ?", (clean_barcode,))
            existing = cursor.fetchone()
            if existing:
                new_qty = existing['quantity'] + quantity
                cursor.execute("""
                    UPDATE products 
                    SET name = ?, quantity = ?, cost_price = ?, selling_price = ?
                    WHERE barcode = ?
                """, (name, new_qty, cost_price, selling_price, clean_barcode))
                conn.commit()
                return

        cursor.execute("""
            INSERT INTO products (name, barcode, quantity, cost_price, selling_price)
            VALUES (?, ?, ?, ?, ?)
        """, (name, clean_barcode, quantity, cost_price, selling_price))
        conn.commit()
    finally:
        conn.close()

def update_product_direct(product_id, name, barcode, quantity, cost_price, selling_price):
    """تعديل مادة بالكامل وبشكل مباشر من الجدول"""
    conn = get_connection()
    cursor = conn.cursor()
    clean_barcode = barcode.strip() if barcode and str(barcode).strip() else None
    try:
        cursor.execute("""
            UPDATE products
            SET name = ?, barcode = ?, quantity = ?, cost_price = ?, selling_price = ?
            WHERE id = ?
        """, (name, clean_barcode, quantity, cost_price, selling_price, product_id))
        conn.commit()
        return True, "تم تحديث البيانات بنجاح!"
    except sqlite3.IntegrityError:
        return False, "الباركود مستخدم في مادة أخرى!"
    except Exception as e:
        return False, str(e)
    finally:
        conn.close()

def delete_product(product_id):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM products WHERE id = ?", (product_id,))
    conn.commit()
    conn.close()

def clear_inventory():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM products")
    conn.commit()
    conn.close()

# ==================== 🛒 المبيعات والإرجاع ====================
def create_sale(cashier_username, customer_name, payment_type, total, discount, final, items):
    conn = get_connection()
    cursor = conn.cursor()

    inv_num = f"INV-{int(datetime.now().timestamp() * 1000)}"

    try:
        # إعادة التحقق من توفر الكمية الفعلية في المخزون قبل تسجيل البيع،
        # لمنع أي بيع لمادة نفدت كميتها بين لحظة العرض ولحظة إتمام البيع
        for item in items:
            cursor.execute("SELECT quantity FROM products WHERE id = ?", (item['id'],))
            row = cursor.fetchone()
            current_qty = row['quantity'] if row else 0
            if current_qty < item['quantity']:
                raise ValueError(f"الكمية المتوفرة من '{item.get('name', '')}' غير كافية (المتوفر: {current_qty})")

        cursor.execute("""
            INSERT INTO sales (invoice_number, cashier_username, customer_name, payment_type, total_amount, discount, final_amount)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (inv_num, cashier_username, customer_name, payment_type, total, discount, final))

        sale_id = cursor.lastrowid

        for item in items:
            cursor.execute("""
                INSERT INTO sale_items (sale_id, product_id, product_name, quantity, cost_price, selling_price, subtotal)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (sale_id, item['id'], item['name'], item['quantity'], item['cost_price'], item['selling_price'], item['subtotal']))

            cursor.execute("UPDATE products SET quantity = quantity - ? WHERE id = ?", (item['quantity'], item['id']))

        if payment_type == "آجل (دين)" and customer_name:
            cursor.execute("""
                INSERT INTO debts (customer_name, phone, amount, paid_amount)
                VALUES (?, ?, ?, 0.0)
            """, (customer_name, "", final))

        conn.commit()
        return inv_num
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

def process_product_return(product_id, product_name, quantity, refund_amount, cashier_username, reason=""):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            INSERT INTO product_returns (product_id, product_name, quantity, refund_amount, cashier_username, reason)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (product_id, product_name, quantity, refund_amount, cashier_username, reason))

        cursor.execute("UPDATE products SET quantity = quantity + ? WHERE id = ?", (quantity, product_id))

        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

def get_sale_items(sale_id):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM sale_items WHERE sale_id = ?", (sale_id,))
    items = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return items

def clear_sales_data():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM sales")
    cursor.execute("DELETE FROM sale_items")
    cursor.execute("DELETE FROM debts")
    cursor.execute("DELETE FROM debt_payments")
    cursor.execute("DELETE FROM product_returns")
    conn.commit()
    conn.close()

clear_sales = clear_sales_data

# ==================== 👥 الديون ====================
def add_new_debt(customer_name, phone, amount):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("INSERT INTO debts (customer_name, phone, amount, paid_amount) VALUES (?, ?, ?, 0.0)", (customer_name, phone, amount))
    conn.commit()
    conn.close()

def get_all_debts():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM debts ORDER BY id DESC")
    debts_rows = cursor.fetchall()
    
    result = []
    now = datetime.now()

    for d in debts_rows:
        item = dict(d)
        rem = item['amount'] - item['paid_amount']
        item['remaining_amount'] = max(0.0, rem)

        try:
            created_dt = datetime.strptime(str(item['created_at']).split('.')[0], "%Y-%m-%d %H:%M:%S")
            days_passed = (now - created_dt).days
        except Exception:
            days_passed = 0

        item['days_passed'] = days_passed
        item['is_overdue'] = (days_passed >= 30 and rem > 0)
        result.append(item)

    conn.close()
    return result

def pay_debt(debt_id, amount_paid, note=""):
    # حماية أساسية: تجاهل أي مبلغ غير صالح بدل تسجيله كدفعة (كان يقبل أي قيمة، حتى سالبة، بدون تحقق)
    if amount_paid is None or amount_paid <= 0:
        return

    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT id FROM debts WHERE id = ?", (debt_id,))
        if not cursor.fetchone():
            return

        cursor.execute("UPDATE debts SET paid_amount = paid_amount + ? WHERE id = ?", (amount_paid, debt_id))
        cursor.execute("INSERT INTO debt_payments (debt_id, amount_paid, note) VALUES (?, ?, ?)", (debt_id, amount_paid, note))
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

def delete_debt(debt_id):
    conn = get_connection()
    cursor = conn.cursor()
    try:
        # حذف صريح للدفعات المرتبطة بالدين، بالإضافة إلى الاعتماد على ON DELETE CASCADE،
        # لضمان عدم بقاء سجلات دفعات يتيمة حتى لو كانت قيود المفاتيح الأجنبية معطلة لأي سبب
        cursor.execute("DELETE FROM debt_payments WHERE debt_id = ?", (debt_id,))
        cursor.execute("DELETE FROM debts WHERE id = ?", (debt_id,))
        conn.commit()
        return True, "تم حذف الدين بنجاح!"
    except Exception as e:
        conn.rollback()
        return False, str(e)
    finally:
        conn.close()

# ==================== 📊 التقارير والماليات ====================
def get_available_months():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT DISTINCT strftime('%Y-%m', created_at) as month FROM sales ORDER BY month DESC")
    months = [row['month'] for row in cursor.fetchall() if row['month']]
    conn.close()
    return months

def get_financial_summary(month="الكل"):
    conn = get_connection()
    cursor = conn.cursor()

    if month == "الكل" or not month:
        cursor.execute("SELECT COUNT(*) as count, SUM(final_amount) as total_sales FROM sales")
        s_res = cursor.fetchone()

        cursor.execute("SELECT SUM(cost_price * quantity) as total_cost FROM sale_items")
        c_res = cursor.fetchone()

        cursor.execute("SELECT SUM(refund_amount) as total_refunds FROM product_returns")
        r_res = cursor.fetchone()
    else:
        cursor.execute("SELECT COUNT(*) as count, SUM(final_amount) as total_sales FROM sales WHERE strftime('%Y-%m', created_at) = ?", (month,))
        s_res = cursor.fetchone()

        cursor.execute("""
            SELECT SUM(si.cost_price * si.quantity) as total_cost 
            FROM sale_items si
            JOIN sales s ON si.sale_id = s.id
            WHERE strftime('%Y-%m', s.created_at) = ?
        """, (month,))
        c_res = cursor.fetchone()

        cursor.execute("SELECT SUM(refund_amount) as total_refunds FROM product_returns WHERE strftime('%Y-%m', created_at) = ?", (month,))
        r_res = cursor.fetchone()

    total_invoices = s_res['count'] if s_res and s_res['count'] else 0
    total_sales = s_res['total_sales'] if s_res and s_res['total_sales'] else 0.0
    total_cost = c_res['total_cost'] if c_res and c_res['total_cost'] else 0.0
    total_refunds = r_res['total_refunds'] if r_res and r_res['total_refunds'] else 0.0

    net_sales = max(0.0, total_sales - total_refunds)
    net_profit = net_sales - total_cost

    conn.close()
    return {
        'total_invoices': total_invoices,
        'total_sales': net_sales,
        'total_cost': total_cost,
        'net_profit': net_profit
    }

def get_sales_reports(month="الكل"):
    conn = get_connection()
    cursor = conn.cursor()
    if month == "الكل" or not month:
        cursor.execute("SELECT * FROM sales ORDER BY id DESC")
    else:
        cursor.execute("SELECT * FROM sales WHERE strftime('%Y-%m', created_at) = ? ORDER BY id DESC", (month,))
    sales = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return sales

def get_returns_report(month="الكل"):
    conn = get_connection()
    cursor = conn.cursor()
    if month == "الكل" or not month:
        cursor.execute("SELECT * FROM product_returns ORDER BY id DESC")
    else:
        cursor.execute("SELECT * FROM product_returns WHERE strftime('%Y-%m', created_at) = ? ORDER BY id DESC", (month,))
    returns_list = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return returns_list

def get_debt_payments_report():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT dp.payment_date, dp.amount_paid, dp.note, d.customer_name
        FROM debt_payments dp
        JOIN debts d ON dp.debt_id = d.id
        ORDER BY dp.id DESC
    """)
    payments = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return payments
