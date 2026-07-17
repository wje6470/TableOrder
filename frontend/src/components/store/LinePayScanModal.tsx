import { Html5Qrcode, Html5QrcodeScannerState, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { secondaryButtonClass } from "../../lib/ui";

interface Props {
  onDetected: (decodedText: string) => void;
  onClose: () => void;
}

// start() 是非同步的（要先跟瀏覽器要相機權限、初始化串流），
// 元件如果在它 resolve 之前就被卸載（React StrictMode 的 mount→unmount→mount，
// 或店員手速很快連按取消），直接呼叫 stop() 會因為 scanner 還沒進入 SCANNING 狀態而丟例外。
// 呼叫前先檢查 getState()，不是在掃描/暫停中就不呼叫 stop()。
async function safeStop(scanner: Html5Qrcode) {
  try {
    const state = scanner.getState();
    if (state === Html5QrcodeScannerState.SCANNING || state === Html5QrcodeScannerState.PAUSED) {
      await scanner.stop();
      scanner.clear();
    }
  } catch {
    // 相機可能還沒真的啟動或已經被關掉了，忽略即可
  }
}

export default function LinePayScanModal({ onDetected, onClose }: Props) {
  const elementId = `linepay-scan-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const [error, setError] = useState<string | null>(null);
  const detectedRef = useRef(false);

  useEffect(() => {
    const scanner = new Html5Qrcode(elementId, {
      formatsToSupport: [
        Html5QrcodeSupportedFormats.QR_CODE,
        Html5QrcodeSupportedFormats.CODE_128,
        Html5QrcodeSupportedFormats.CODE_39,
        Html5QrcodeSupportedFormats.EAN_13,
      ],
      verbose: false,
    });
    let disposed = false;

    scanner
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 260, height: 260 } },
        (decodedText) => {
          if (detectedRef.current) return;
          detectedRef.current = true;
          onDetected(decodedText);
        },
        () => {
          // 每一幀掃不到東西都會呼叫這個 callback，是正常現象，不用處理
        }
      )
      .then(() => {
        if (disposed) void safeStop(scanner);
      })
      .catch((err) => {
        if (!disposed) {
          setError(err instanceof Error ? err.message : "無法開啟相機，請確認已允許瀏覽器使用鏡頭權限");
        }
      });

    return () => {
      disposed = true;
      void safeStop(scanner);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elementId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 dark:bg-gray-800">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">掃描顧客 LINE Pay 付款碼</h2>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {error ? (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        ) : (
          <div id={elementId} className="overflow-hidden rounded-xl bg-black" />
        )}
        <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">
          請顧客打開 LINE Pay 付款頁面，把畫面上的條碼／QR code 對準鏡頭
        </p>
        <button onClick={onClose} className={`mt-4 w-full ${secondaryButtonClass}`}>
          取消
        </button>
      </div>
    </div>
  );
}
