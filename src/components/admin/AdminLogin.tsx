import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { getStorage } from '../../services/storageFactory';
import { clearReloginNotice, readReloginNotice } from '../../utils/browserState';
import { Button, Input } from '../Common';

interface AdminLoginProps {
  onLogin: () => void;
}

export const AdminLogin: React.FC<AdminLoginProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [keep, setKeep] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (readReloginNotice()) {
      setNotice('安全配置已更新，请使用最新账号密码重新登录。');
      clearReloginNotice();
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const storage = getStorage();
      if (storage.login) {
        const res = await storage.login(username, password, keep);
        if (res.success) onLogin();
        else setError(res.error || '账号或密码错误');
      } else {
        setError('当前存储模式未启用登录接口');
      }
    } catch (err) {
      setError('连接失败，请检查配置');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen items-center justify-center bg-[color:var(--bg-soft)] p-6 transition-colors duration-300">
      <div className="w-full max-w-md rounded-[8px] border border-[color:var(--line)] bg-[color:var(--surface)] p-6 shadow-sm md:p-8">
        <h2 className="mb-8 text-center text-xl font-semibold text-[color:var(--text-primary)]">后台管理登录</h2>
        <form onSubmit={handleSubmit} className="space-y-5">
          <Input label="账号" value={username} onChange={(e) => setUsername(e.target.value)} className="h-10 rounded-[6px] text-sm" />
          <Input label="密码" type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="h-10 rounded-[6px] text-sm" />
          <div className="flex items-center gap-2 px-0.5">
            <input
              type="checkbox"
              id="keep"
              checked={keep}
              onChange={(e) => setKeep(e.target.checked)}
              className="h-4 w-4 rounded-[4px] border-stone-300 text-ink focus:ring-ink"
            />
            <label htmlFor="keep" className="cursor-pointer text-sm font-medium text-[color:var(--text-secondary)]">保持登录</label>
          </div>
          {notice && (
            <div className="rounded-[6px] border border-emerald-100 bg-emerald-50 p-3 text-sm font-medium text-emerald-700">
              {notice}
            </div>
          )}
          {error && (
            <div className="rounded-[6px] border border-red-100 bg-red-50 p-3 text-sm font-medium text-red-600 dark:border-red-900/30 dark:bg-red-900/20 dark:text-red-400">
              {error}
            </div>
          )}
          <Button type="submit" className="h-10 w-full rounded-[6px] text-sm" disabled={loading}>
            {loading ? <Loader2 className="animate-spin" /> : '登录系统'}
          </Button>
        </form>
      </div>
    </div>
  );
};
