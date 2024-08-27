import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';

type TreeFileNode = {
  dir: string;
  name: string;
  length: number;
  children?: TreeFileNode[];
};

export const App: React.FC = () => {
  const [treeData, setTreeData] = useState<TreeFileNode[]>([]);

  useEffect(() => {
    // VS Code の API にアクセス
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const vscode = (window as any).acquireVsCodeApi();

    // 初期ロード時にツリーデータを要求
    vscode.postMessage({ command: 'loadTreeData' });

    window.addEventListener('message', event => {
      const message = event.data; // メッセージデータを取得
      switch (message.command) {
        case 'treeData':
          setTreeData(message.data); // データセット
          break;
      }
    });
  }, []);

  return (
    <div>
      <h1>Draft Tree</h1>
      <pre>{JSON.stringify(treeData, null, 2)}</pre>
      {/* ツリー表示のロジックをここに追加 */}
    </div>
  );
};

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(<App />);
