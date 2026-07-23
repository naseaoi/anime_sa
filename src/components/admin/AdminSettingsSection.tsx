import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { PublicData, SiteSettings } from '../../types';
import { getAdminProfile, logoutServerSession, updateAdminCredentials } from '../../services/storageFactory';
import { errorMessage } from '../../services/apiClient';
import { DEFAULT_THEME_COLOR, isValidThemeColor } from '../../utils/themeColor';
import { writeReloginNotice } from '../../utils/browserState';
import { Button, ConfirmModal, Input, useToast } from '../Common';
import { AdminPanel } from './ui';

interface AdminSettingsSectionProps {
  data: PublicData;
  onUpdate: (d: PublicData) => void;
}

const THEME_PRESETS = ['#c78c2b', '#2563eb', '#0ea5e9', '#10b981', '#ec4899', '#8b5cf6', '#ef4444', '#f97316'];

export const AdminSettingsSection: React.FC<AdminSettingsSectionProps> = ({ data, onUpdate }) => {
  const [siteSettings, setSiteSettings] = useState(data.settings);
  const [username, setUsername] = useState('');
  const [initialUsername, setInitialUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingCreds, setSavingCreds] = useState(false);
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
      .catch((error: unknown) => showToast(errorMessage(error, '读取管理员信息失败'), 'error'));
  }, [showToast]);

  const updateSettings = (nextSettings: SiteSettings) => {
    setSiteSettings(nextSettings);
    onUpdate({ ...data, settings: nextSettings });
  };

  const currentThemeColor = siteSettings.themeColor && isValidThemeColor(siteSettings.themeColor)
    ? siteSettings.themeColor
    : DEFAULT_THEME_COLOR;
  const [themeColorInput, setThemeColorInput] = useState(currentThemeColor);

  useEffect(() => {
    setThemeColorInput(currentThemeColor);
  }, [currentThemeColor]);

  const setThemeColor = (color: string) => updateSettings({ ...siteSettings, themeColor: color });

  const handleThemeColorText = (raw: string) => {
    const value = raw.startsWith('#') ? raw : `#${raw}`;
    setThemeColorInput(value);
    if (isValidThemeColor(value)) setThemeColor(value.toLowerCase());
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
      writeReloginNotice();
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

        <div className="mt-4 space-y-3 border-t border-[color:var(--line)] pt-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-[color:var(--text-primary)]">主题色</span>
            <button
              type="button"
              onClick={() => setThemeColor(DEFAULT_THEME_COLOR)}
              className="text-xs font-semibold text-[color:var(--text-secondary)] transition-colors hover:text-[color:var(--accent)]"
            >
              恢复默认
            </button>
          </div>
          <div className="flex items-center gap-3">
            <label className="relative h-10 w-12 shrink-0 cursor-pointer overflow-hidden rounded-[6px] border border-[color:var(--line)]">
              <input
                type="color"
                value={currentThemeColor}
                onChange={(e) => setThemeColor(e.target.value.toLowerCase())}
                className="absolute -left-2 -top-2 h-14 w-16 cursor-pointer border-0 bg-transparent p-0"
              />
            </label>
            <input
              type="text"
              value={themeColorInput}
              onChange={(e) => handleThemeColorText(e.target.value)}
              spellCheck={false}
              maxLength={7}
              className="h-10 w-full rounded-[6px] border border-[color:var(--line)] bg-[color:var(--surface)] px-3 font-mono text-sm uppercase text-[color:var(--text-primary)] outline-none focus:border-[color:var(--accent)] focus:ring-4 focus:ring-[color:var(--accent-soft)]"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {THEME_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setThemeColor(preset)}
                title={preset}
                className={`h-7 w-7 rounded-full border transition-transform hover:scale-110 ${
                  currentThemeColor.toLowerCase() === preset.toLowerCase()
                    ? 'border-[color:var(--text-primary)] ring-2 ring-[color:var(--accent-soft)]'
                    : 'border-[color:var(--line)]'
                }`}
                style={{ backgroundColor: preset }}
              />
            ))}
          </div>
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
          <Input
            label="新密码"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="留空则不修改"
            className="h-10 rounded-[6px] text-sm"
          />
          <Input
            label="确认新密码"
            type="password"
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
