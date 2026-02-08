import React, { useEffect, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { PublicData } from '../../types';
import { getAdminProfile, logoutServerSession, updateAdminCredentials } from '../../services/storageFactory';
import { AdminCard, Button, ConfirmModal, Input, useToast } from '../Common';

interface AdminSettingsSectionProps {
  data: PublicData;
  onUpdate: (d: PublicData) => void;
}

export const AdminSettingsSection: React.FC<AdminSettingsSectionProps> = ({ data, onUpdate }) => {
  const [siteSettings, setSiteSettings] = useState(data.settings);
  const [username, setUsername] = useState('');
  const [initialUsername, setInitialUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingCreds, setSavingCreds] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [confirmLogoutModalOpen, setConfirmLogoutModalOpen] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    getAdminProfile()
      .then((profile) => {
        setUsername(profile.username);
        setInitialUsername(profile.username);
      })
      .catch((e: any) => showToast(e?.message || '读取管理员信息失败', 'error'));
  }, []);

  const willRequireRelogin = () => {
    const nextUsername = username.trim();
    return nextUsername !== initialUsername || newPassword.length > 0;
  };

  const saveCredentials = async (confirmed = false) => {
    const nextUsername = username.trim();
    if (!nextUsername) {
      showToast('账号不能为空', 'error');
      return;
    }

    if (newPassword && newPassword !== confirmPassword) {
      showToast('两次输入的新密码不一致', 'error');
      return;
    }

    if (willRequireRelogin() && !confirmed) {
      setConfirmLogoutModalOpen(true);
      return;
    }

    setSavingCreds(true);
    const res = await updateAdminCredentials({
      username: nextUsername,
      newPassword: newPassword || undefined
    });
    setSavingCreds(false);

    if (!res.success) {
      showToast(res.error || '失败', 'error');
      return;
    }

    setNewPassword('');
    setConfirmPassword('');
    if (res.requireRelogin) {
      sessionStorage.setItem('tat_relogin_notice', '1');
      showToast('安全配置已更新，请重新登录', 'success');
      await logoutServerSession();
      window.location.reload();
      return;
    }
    showToast('已保存');
  };

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
            <Input label="账号" value={username} onChange={(e) => setUsername(e.target.value)} className="h-12 text-base" />
            <div className="relative">
              <Input label="新密码（留空则不修改）" type={showPassword ? 'text' : 'password'} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="h-12 text-base" />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-[38px] text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)]">
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
            <Input
              label="确认新密码"
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="h-12 text-base"
            />
            <Button
              className="w-full h-12 rounded-xl text-base"
              onClick={() => saveCredentials()}
              disabled={savingCreds}
            >
              保存安全配置
            </Button>
          </div>
        </AdminCard>
      </div>

      <ConfirmModal
        isOpen={confirmLogoutModalOpen}
        onClose={() => setConfirmLogoutModalOpen(false)}
        onConfirm={() => {
          setConfirmLogoutModalOpen(false);
          saveCredentials(true);
        }}
        title="确认更新安全配置"
        message="账号或密码变更后，当前会话将立即失效并需要重新登录。是否继续？"
        confirmText="继续保存"
        type="info"
      />
    </div>
  );
};
