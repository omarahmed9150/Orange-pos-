import { FormEvent, useEffect, useState } from 'react';
import { api } from '../lib/api';

type Role = 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'CASHIER';

interface AppUser {
  id: string;
  username: string;
  fullName: string;
  role: Role;
  isActive: boolean;
}

export function Users() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('CASHIER');
  const [error, setError] = useState('');

  async function load() {
    const { data } = await api.get('/users');
    setUsers(data);
  }

  useEffect(() => {
    load();
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await api.post('/users', { username, fullName, password, role });
      setShowForm(false);
      setUsername(''); setFullName(''); setPassword(''); setRole('CASHIER');
      load();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'تعذر إنشاء المستخدم');
    }
  }

  async function toggleActive(u: AppUser) {
    await api.patch(`/users/${u.id}`, { isActive: !u.isActive });
    load();
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">إدارة المستخدمين</h1>
        <button onClick={() => setShowForm(!showForm)} className="bg-orange text-white rounded-lg px-4 py-2 font-semibold">
          {showForm ? 'إلغاء' : '+ مستخدم جديد'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={onSubmit} className="bg-white rounded-2xl shadow p-5 grid grid-cols-2 gap-3">
          {error && <p className="col-span-2 text-red-600 text-sm">{error}</p>}
          <div>
            <label className="block text-sm mb-1">اسم المستخدم</label>
            <input value={username} onChange={(e) => setUsername(e.target.value)} required className="w-full border rounded-lg px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm mb-1">الاسم الكامل</label>
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} required className="w-full border rounded-lg px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm mb-1">كلمة السر</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} className="w-full border rounded-lg px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm mb-1">الدور</label>
            <select value={role} onChange={(e) => setRole(e.target.value as Role)} className="w-full border rounded-lg px-3 py-2">
              <option value="CASHIER">كاشير</option>
              <option value="MANAGER">مدير فرع</option>
              <option value="ADMIN">أدمن</option>
              <option value="SUPER_ADMIN">مدير عام</option>
            </select>
          </div>
          <button className="col-span-2 bg-orange text-white rounded-lg py-2 font-semibold">إنشاء الحساب</button>
        </form>
      )}

      <div className="bg-white rounded-2xl shadow divide-y">
        {users.map((u) => (
          <div key={u.id} className="p-4 flex justify-between items-center">
            <div>
              <p className="font-semibold">{u.fullName} <span className="text-gray-400 text-sm">@{u.username}</span></p>
              <p className="text-sm text-gray-500">{u.role}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className={u.isActive ? 'text-emerald-600 text-sm' : 'text-red-500 text-sm'}>
                {u.isActive ? 'مفعّل' : 'محظور'}
              </span>
              <button
                onClick={() => toggleActive(u)}
                className="bg-gray-100 hover:bg-gray-200 rounded-lg px-3 py-1.5 text-sm"
              >
                {u.isActive ? 'حظر' : 'تفعيل'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
