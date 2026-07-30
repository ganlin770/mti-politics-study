import { Cloud, CloudOff, LoaderCircle, LogOut, Mail, X } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { useStudy } from '../state/StudyProvider';

interface AuthDialogProps {
  open: boolean;
  onClose: () => void;
}

export function AuthDialog({ open, onClose }: AuthDialogProps) {
  const { user, cloudStatus, cloudMessage, supabaseConfigured, sendMagicLink, importGuestProgress, signOut } = useStudy();
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopImmediatePropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose, open]);

  if (!open) return null;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get('email') || '').trim();
    if (!email) return;
    setBusy(true);
    setMessage('');
    try {
      setMessage(await sendMagicLink(email));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '发送失败，请稍后重试。');
    } finally {
      setBusy(false);
    }
  }

  async function handleSignOut() {
    setBusy(true);
    try {
      await signOut();
      setMessage('已退出，之后的进度只保存在本机。');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '退出失败。');
    } finally {
      setBusy(false);
    }
  }

  async function handleGuestImport() {
    setBusy(true);
    setMessage('');
    try {
      setMessage(await importGuestProgress());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '导入失败。');
    } finally {
      setBusy(false);
    }
  }

  return createPortal(
    <div className="dialog-layer" role="presentation">
      <button className="dialog-scrim" type="button" aria-label="关闭云同步" onClick={onClose} />
      <section className="auth-dialog" role="dialog" aria-modal="true" aria-labelledby="auth-title">
        <button ref={closeRef} className="icon-button dialog-close" type="button" onClick={onClose} aria-label="关闭">
          <X aria-hidden="true" />
        </button>
        <div className="eyebrow">SUPABASE CLOUD</div>
        <h2 id="auth-title">把进度带到每台设备</h2>
        <p>不登录也能完整学习；邮箱登录后，课程进度、自测和复盘会按你的账号隔离同步。</p>
        <div className={`cloud-state cloud-state--${cloudStatus}`}>
          {cloudStatus === 'connecting' ? <LoaderCircle className="spin" /> : user ? <Cloud /> : <CloudOff />}
          <span>{user ? user.email : cloudMessage}</span>
        </div>
        {user ? (
          <div className="auth-actions">
            <button className="button button--primary full-button" type="button" onClick={handleGuestImport} disabled={busy}>
              导入本机匿名进度
            </button>
            <button className="button button--secondary full-button" type="button" onClick={handleSignOut} disabled={busy}>
              <LogOut aria-hidden="true" />退出云同步
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="auth-form">
            <label htmlFor="auth-email">登录邮箱</label>
            <div className="input-with-button">
              <span aria-hidden="true"><Mail /></span>
              <input id="auth-email" name="email" type="email" autoComplete="email" required placeholder="name@example.com" />
              <button className="button button--primary" type="submit" disabled={busy || !supabaseConfigured}>
                {busy ? '发送中…' : '发送登录链接'}
              </button>
            </div>
          </form>
        )}
        {!supabaseConfigured ? (
          <p className="form-note form-note--warning">当前部署尚未配置 Supabase 环境变量，因此保持本机模式。</p>
        ) : null}
        <p className="form-note" role="status">{message || (user ? '匿名进度不会默认并入任何账号；只有你点击导入时才会合并。' : '登录链接有效期内点击一次即可，网站不会保存你的邮箱密码。')}</p>
      </section>
    </div>,
    document.body,
  );
}
