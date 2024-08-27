import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";

// TypeScript の型定義
type TreeFileNode = {
  dir: string;
  name: string;
  length: number;
  children?: TreeFileNode[];
};

interface TreeViewProps {
  node: TreeFileNode;
}

const TreeView: React.FC<TreeViewProps> = ({ node }) => {
  const [expanded, setExpanded] = useState(true);

    //フォルダーの開け閉め
  const toggleExpand = () => {
    setExpanded(!expanded);
  };

  // クリックしてファイルを開くコマンドをVS Codeに送信
  const handleNodeClick = (event: React.MouseEvent<HTMLSpanElement>) => {
    event.stopPropagation();
    if(!node.children){
        vscode.postMessage({
          command: "openFile",
          filePath: node.dir,
        });
    } else {
        toggleExpand();
    }
  };

  return (
    <div
      className={`tree-node ${expanded ? "expanded" : ""} ${
        !node.children ? "text" : ""
      }`}
      onClick={handleNodeClick}
    >
      <span className="triangle" onClick={toggleExpand}>
        &gt;
      </span>
      <span className="label">
        {node.name.replace(/(\d+[-_\s]*)*(.+)(\.(txt|md))*/, "$2")}
      </span>
      <span className="chars">{node.length.toLocaleString()}文字</span>
      {node.children && (
        <div className="tree-node-children">
          {node.children.map((child) => (
            <TreeView key={child.name} node={child} /> // Assuming 'name' is unique within the directory
          ))}
        </div>
      )}
    </div>
  );
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const vscode = (window as any).acquireVsCodeApi();

const ToggleSwitch: React.FC<{ isOn: boolean, handleToggle: () => void }> = ({ isOn, handleToggle }) => {
    return (
      <label className="switch">
        <input type="checkbox" checked={isOn} onChange={handleToggle} />
        <span className="slider round"></span>
      </label>
    );
  };

export const App: React.FC = () => {
  const [treeData, setTreeData] = useState<TreeFileNode[]>([]);
  const [isOrdable, setIsOrdable] = useState(false);

  useEffect(() => {
    vscode.postMessage({ command: "loadTreeData" });

    const handleMessage = (event: MessageEvent) => {
      const message = event.data; // メッセージデータを取得
      console.log(message);
      switch (message.command) {
        case "treeData":
          setTreeData(message.data); // データセット
          break;
      }
    };

    window.addEventListener("message", handleMessage);

    // クリーンアップ関数でイベントリスナーを解除
    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, []);

  return (
    <div>
                <span>並び順の変更:</span>
                <ToggleSwitch isOn={isOrdable} handleToggle={() => setIsOrdable(!isOrdable)} />
      {treeData.length === 0 ? (
        <p>Loading...</p>
      ) : (
        treeData.map((node, index) => <TreeView key={index} node={node} />)
      )}
    </div>
  );
};

// root.render を呼び出す
const root = ReactDOM.createRoot(document.getElementById("root")!);
root.render(<App />);
