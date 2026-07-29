import { useCallback } from 'react';
import { useLocation, useNavigate } from '../router';

// 详情页返回：优先回跳来源路径，其次浏览器后退，最后回落到分区页
export const useDetailBack = (section?: string) => {
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;

  return useCallback(() => {
    if (from && from.startsWith('/')) {
      navigate(from, { replace: true });
      return;
    }

    const fromSameOrigin = !!document.referrer && document.referrer.startsWith(window.location.origin);
    if (window.history.length > 1 && fromSameOrigin) {
      navigate(-1);
      return;
    }

    navigate(section && section !== 'all' ? `/${section}` : '/', { replace: true });
  }, [from, navigate, section]);
};
