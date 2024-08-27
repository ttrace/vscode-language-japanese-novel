import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';

type TreeFileNode = {
  dir: string;
  name: string;
  length: number;
  children?: TreeFileNode[];
};

const TreeNode: React.FC<{ node: TreeFileNode }> = ({ node }) => {
  return (
    <div style={{ marginLeft: 20 }}>
      <div>{node.name}</div>
      {node.children && (
        <div>
          {node.children.map((child) => (
            <TreeNode key={child.name} node={child} />
          ))}
        </div>
      )}
    </div>
  );
};

export const App: React.FC = () => {
  const [treeData, setTreeData] = useState<TreeFileNode[]>([]);

  useEffect(() => {
    // VS Code の API にアクセス
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const vscode = (window as any).acquireVsCodeApi();

    // 初期ロード時にツリーデータを要求
    console.log("初期ロード時にツリーデータを要求");
    vscode.postMessage({ command: 'loadTreeData' });

    window.addEventListener('message', event => {
      const message = event.data; // メッセージデータを取得
      console.log(message);
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
      <div>
        {treeData.map((node) => (
          <TreeNode key={node.name} node={node} />
        ))}
      </div>
    </div>
  );
};

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(<App />);
