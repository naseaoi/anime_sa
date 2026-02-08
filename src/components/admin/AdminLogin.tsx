import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { getStorage } from '../../services/storageFactory';
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
    const key = sessionStorage.getItem('tat_relogin_notice');
    if (key) {
      setNotice('安全配置已更新，请使用最新账号密码重新登录。');
      sessionStorage.removeItem('tat_relogin_notice');
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
    <div className="h-screen flex items-center justify-center p-6 transition-colors duration-300">
      <div className="w-full max-w-md glass-panel rounded-3xl p-10 md:p-12">
        <h2 className="text-2xl font-bold text-center text-[color:var(--text-primary)] mb-10">后台管理登录</h2>
        <form onSubmit={handleSubmit} className="space-y-8">
          <Input label="账号" value={username} onChange={(e) => setUsername(e.target.value)} className="h-12 text-base" />
          <Input label="密码" type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="h-12 text-base" />
          <div className="flex items-center gap-2 px-1">
            <input
              type="checkbox"
              id="keep"
              checked={keep}
              onChange={(e) => setKeep(e.target.checked)}
              className="w-5 h-5 rounded border-stone-300 text-ink focus:ring-ink"
            />
            <label htmlFor="keep" className="text-sm font-bold text-[color:var(--text-secondary)] cursor-pointer">保持登录</label>
          </div>
          {notice && (
            <div className="p-4 bg-emerald-50 text-emerald-700 text-sm font-bold rounded-xl border border-emerald-100">
              {notice}
            </div>
          )}
          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm font-bold rounded-xl border border-red-100 dark:border-red-900/30">
              {error}
            </div>
          )}
          <Button type="submit" className="w-full h-14 rounded-2xl text-lg" disabled={loading}>
            {loading ? <Loader2 className="animate-spin" /> : '登录系统'}
          </Button>
        </form>
      </div>
    </div>
  );
};
