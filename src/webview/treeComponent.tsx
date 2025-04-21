import React, { useState } from "react";

// TypeScript の型定義 (必要なら別のファイルにしても良い)
type TreeFileNode = {
  dir: string;
  name: string;
  length: number;
  children?: TreeFileNode[];
  isClosed?: boolean;
};

interface TreeViewProps {
  node: TreeFileNode;
  highlightedNode: string | null;
  onHighlight: (nodeDir: string) => void;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const vscode = (window as any).acquireVsCodeApi();

export const TreeView: React.FC<TreeViewProps> = ({
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
      className={`tree-node ${expanded ? "expanded" : ""}  ${
        highlightedNode === node.dir ? "highlighted" : ""
      }`}
      onClick={handleNodeClick}
    >
      <div className={`tree-label ${!node.children ? "text" : ""}`}>
        <span className="triangle" onClick={toggleExpand}>
          &gt;
        </span>
        <span className="item-name">
          {node.name.replace(/^(?:\d+[-_\s]*)*(.+?)(?:\.(txt|md))?$/, "$1")}
        </span>
        <span className="chars">{node.length.toLocaleString()}文字</span>
      </div>
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
