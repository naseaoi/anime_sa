import React, { useEffect, useState } from 'react';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { PublicData, SiteSettings } from '../../types';
import { getAdminProfile, logoutServerSession, updateAdminCredentials } from '../../services/storageFactory';
import { Button, ConfirmModal, Input, useToast } from '../Common';
import { AdminIconButton, AdminPanel } from './ui';

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
    setSiteSettings(data.settings);
  }, [data.settings]);

  useEffect(() => {
    getAdminProfile()
      .then((profile) => {
        setUsername(profile.username);
        setInitialUsername(profile.username);
      })
      .catch((e: any) => showToast(e?.message || '读取管理员信息失败', 'error'));
  }, []);

  const updateSettings = (nextSettings: SiteSettings) => {
    setSiteSettings(nextSettings);
    onUpdate({ ...data, settings: nextSettings });
  };

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
    setInitialUsername(nextUsername);
    showToast('已保存');
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
      <AdminPanel title="站点信息">
        <div className="grid gap-4 md:grid-cols-2">
          <Input
            label="网站标题"
            value={siteSettings.title}
            onChange={(e) => updateSettings({ ...siteSettings, title: e.target.value })}
            className="h-10 rounded-[6px] text-sm"
          />
          <Input
            label="图标 URL"
            value={siteSettings.iconUrl}
            onChange={(e) => updateSettings({ ...siteSettings, iconUrl: e.target.value })}
            className="h-10 rounded-[6px] text-sm"
          />
          <Input
            label="Footer 左侧文案"
            value={siteSettings.footerLeft || ''}
            onChange={(e) => updateSettings({ ...siteSettings, footerLeft: e.target.value })}
            className="h-10 rounded-[6px] text-sm"
          />
          <Input
            label="Footer 右侧文案"
            value={siteSettings.footerRight || ''}
            onChange={(e) => updateSettings({ ...siteSettings, footerRight: e.target.value })}
            className="h-10 rounded-[6px] text-sm"
          />
        </div>
      </AdminPanel>

      <AdminPanel title="安全配置">
        <div className="space-y-4">
          <Input
            label="账号"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="h-10 rounded-[6px] text-sm"
          />
          <div className="relative">
            <Input
              label="新密码"
              type={showPassword ? 'text' : 'password'}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="留空则不修改"
              className="h-10 rounded-[6px] pr-11 text-sm"
            />
            <AdminIconButton
              label={showPassword ? '隐藏密码' : '显示密码'}
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-1 top-[25px]"
            >
              {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
            </AdminIconButton>
          </div>
          <Input
            label="确认新密码"
            type={showPassword ? 'text' : 'password'}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="h-10 rounded-[6px] text-sm"
          />
          <Button
            className="h-10 w-full rounded-[6px] text-sm"
            onClick={() => saveCredentials()}
            disabled={savingCreds}
          >
            {savingCreds ? <Loader2 className="animate-spin" size={15} /> : null}
            保存安全配置
          </Button>
        </div>
      </AdminPanel>

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
