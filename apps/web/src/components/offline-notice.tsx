import { useEffect, useState } from 'react';
import { observeNetworkStatus } from '../lib/network-status';

export function OfflineNotice(): React.JSX.Element | null {
  const [visible, setVisible] = useState(false);
  useEffect(() => observeNetworkStatus({ onOffline: () => setVisible(true), onOnline: () => setVisible(false) }), []);
  return visible ? <div className="offline-notice" role="status">Bạn đang ngoại tuyến. Không thể lưu thay đổi.</div> : null;
}
