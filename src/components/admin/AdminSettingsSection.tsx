import React, { useEffect, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { PublicData } from '../../types';
import { getStorage } from '../../services/storageFactory';
import { AdminCard, Button, Input, useToast } from '../Common';

interface AdminSettingsSectionProps {
  data: PublicData;
  onUpdate: (d: PublicData) => void;
}

export const AdminSettingsSection: React.FC<AdminSettingsSectionProps> = ({ data, onUpdate }) => {
  const [siteSettings, setSiteSettings] = useState(data.settings);
  const [creds, setCreds] = useState({ username: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    const storage = getStorage();
    storage.getPrivateData().then(setCreds);
  }, []);

  return (
    <div className="flex flex-col gap-10 max-w-5xl mx-auto">
      <div className="w-full">
        <AdminCard title="网站设置">
          <div className="space-y-8">
            <Input
              label="网站标题"
              value={siteSettings.title}
              onChange={(e) => {
                const nextSettings = { ...siteSettings, title: e.target.value };
                setSiteSettings(nextSettings);
                onUpdate({ ...data, settings: nextSettings });
              }}
              className="h-12 text-base"
            />
            <Input
              label="图标 (URL)"
              value={siteSettings.iconUrl}
              onChange={(e) => {
                const nextSettings = { ...siteSettings, iconUrl: e.target.value };
                setSiteSettings(nextSettings);
                onUpdate({ ...data, settings: nextSettings });
              }}
              className="h-12 text-base"
            />
            <Input
              label="Footer 左侧文案"
              value={siteSettings.footerLeft || ''}
              onChange={(e) => {
                const nextSettings = { ...siteSettings, footerLeft: e.target.value };
                setSiteSettings(nextSettings);
                onUpdate({ ...data, settings: nextSettings });
              }}
              className="h-12 text-base"
            />
            <Input
              label="Footer 右侧文案"
              value={siteSettings.footerRight || ''}
              onChange={(e) => {
                const nextSettings = { ...siteSettings, footerRight: e.target.value };
                setSiteSettings(nextSettings);
                onUpdate({ ...data, settings: nextSettings });
              }}
              className="h-12 text-base"
            />
          </div>
        </AdminCard>
      </div>
      <div className="w-full">
        <AdminCard title="安全选项">
          <div className="space-y-6">
            <Input label="账号" value={creds.username} onChange={(e) => setCreds({ ...creds, username: e.target.value })} className="h-12 text-base" />
            <div className="relative">
              <Input label="密码" type={showPassword ? 'text' : 'password'} value={creds.password} onChange={(e) => setCreds({ ...creds, password: e.target.value })} className="h-12 text-base" />
              <button onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-[38px] text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)]">
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
            <Button
              className="w-full h-12 rounded-xl text-base"
              onClick={async () => {
                const storage = getStorage();
                const res = await storage.savePrivateData(creds);
                if (res.success) showToast('已保存');
                else showToast('失败', 'error');
              }}
            >
              保存安全配置
            </Button>
          </div>
        </AdminCard>
      </div>
    </div>
  );
};
