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
  highlightedNode: string | null;
  onHighlight: (nodeDir: string) => void;
}

const TreeView: React.FC<TreeViewProps> = ({
  node,
  highlightedNode,
  onHighlight,
}) => {
  const [expanded, setExpanded] = useState(true);

  //フォルダーの開け閉め
  const toggleExpand = () => {
    setExpanded(!expanded);
  };

  // クリックしてファイルを開くコマンドをVS Codeに送信
  const handleNodeClick = (event: React.MouseEvent<HTMLSpanElement>) => {
    event.stopPropagation();
    if (!node.children) {
      vscode.postMessage({
        command: "openFile",
        filePath: node.dir,
      });

      // ハイライトを少し遅らせて設定
      setTimeout(() => onHighlight(node.dir), 200);
      //   onHighlight(node.dir);
    } else {
      toggleExpand();
    }
  };

  return (
    <div
      className={`tree-node ${expanded ? "expanded" : ""} ${
        !node.children ? "text" : ""
      } ${highlightedNode === node.dir ? "highlighted" : ""}`}
      onClick={handleNodeClick}
    >
      <span className="triangle" onClick={toggleExpand}>
        &gt;
      </span>
      <span className="label">
        {node.name.replace(/^(?:\d+[-_\s]*)*(.+?)(?:\.(txt|md))?$/, "$1")}
      </span>
      <span className="chars">{node.length.toLocaleString()}文字</span>
      {node.children && (
        <div className="tree-node-children">
          {node.children.map((child) => (
            <TreeView
              key={child.name}
              node={child}
              highlightedNode={highlightedNode}
              onHighlight={onHighlight}
            /> // Assuming 'name' is unique within the directory
          ))}
        </div>
      )}
    </div>
  );
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const vscode = (window as any).acquireVsCodeApi();

const ToggleSwitch: React.FC<{ isOn: boolean; handleToggle: () => void }> = ({
  isOn,
  handleToggle,
}) => {
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
  const [highlightedNode, setHighlightedNode] = useState<string | null>(null);

  useEffect(() => {
    vscode.postMessage({ command: "loadTreeData" });

    const handleMessage = (event: MessageEvent) => {
      const message = event.data; // メッセージデータを取得
      switch (message.command) {
        case "treeData":
          setTreeData(message.data); // データセット
          break;
        case "clearHighlight":
          setHighlightedNode(null);
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
      <div className="toggle-switch">
        <span>並び順の変更:</span>
        <ToggleSwitch
          isOn={isOrdable}
          handleToggle={() => setIsOrdable(!isOrdable)}
        />
      </div>
      {treeData.length === 0 ? (
        <p>Loading...</p>
      ) : (
        treeData.map((node, index) => (
          <TreeView
            key={index}
            node={node}
            highlightedNode={highlightedNode}
            onHighlight={setHighlightedNode}
          />
        ))
      )}
    </div>
  );
};

// root.render を呼び出す
const root = ReactDOM.createRoot(document.getElementById("root")!);
root.render(<App />);
