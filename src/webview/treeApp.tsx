import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { useDrag, useDrop, DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
//  import { TreeView } from "./treeComponent";

// TypeScript の型定義
type TreeFileNode = {
  dir: string;
  name: string;
  length: number;
  children?: TreeFileNode[];
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
  const [isDraggingGlobal, setIsDraggingGlobal] = useState(false);

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
      <div className="tree-wrapper">
        <DndProvider backend={HTML5Backend}>
          {treeData.length === 0 ? (
            <p>Loading...</p>
          ) : (
            treeData.map((node, index) => (
              <TreeView
                key={index}
                node={node}
                highlightedNode={highlightedNode}
                onHighlight={setHighlightedNode}
                isDraggingGlobal={isDraggingGlobal}
                setIsDraggingGlobal={setIsDraggingGlobal}
                isFirstSibling={index === 0}
              />
            ))
          )}
        </DndProvider>
      </div>
    </div>
  );
};

interface TreeViewProps {
  node: TreeFileNode;
  highlightedNode: string | null;
  onHighlight: (nodeDir: string) => void;
  isDraggingGlobal: boolean;
  setIsDraggingGlobal: (isDragging: boolean) => void;
  isFirstSibling: boolean;
}

// // eslint-disable-next-line @typescript-eslint/no-explicit-any
// const vscode = (window as any).acquireVsCodeApi();

const TreeView: React.FC<TreeViewProps> = ({
  node,
  highlightedNode,
  onHighlight,
  isDraggingGlobal,
  setIsDraggingGlobal,
  isFirstSibling,
}) => {
  // フォルダーが開いているかどうかを知るステータス（初期状態は開）
  const [expanded, setExpanded] = useState(true);
  // ドラッグ中かどうかを知るステータス（初期状態はfalse）
  const [isDragging, setIsDragging] = useState(false);
  // ドロップ対象かどうかを知るステータス（初期状態はfalce）
  const [isDraggedOverBefore, setIsDraggedOverBefore] = useState(false);
  const [isDraggedOverAfter, setIsDraggedOverAfter] = useState(false);

  const handleDragStart = (e: { stopPropagation: () => void }) => {
    console.log("DnD Dev: ドラッグ開始");
    e.stopPropagation(); // イベントのバブリングを防止
    setIsDragging(true);
    setIsDraggingGlobal(true);
  };

  const handleDragEnd = (e: { stopPropagation: () => void }) => {
    e.stopPropagation(); // イベントのバブリングを防止
    setIsDragging(false);
    setIsDraggingGlobal(false);
  };

  //フォルダーの開け閉め
  const toggleExpand = () => {
    setExpanded(!expanded);
  };

  // クリックしてファイルを開くコマンド。VS Codeに送信する部分も含む
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

  const handleDragEnterBefore = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggedOverBefore(true);
    e.stopPropagation();
  };

  const handleDragLeaveBefore = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggedOverBefore(false);
    e.stopPropagation();
  };

  const handleDragEnterAfter = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggedOverAfter(true);
    e.stopPropagation();
  };

  const handleDragLeaveAfter = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggedOverAfter(false);
    e.stopPropagation();
  };

  // MARK: D&D
  // ドラッグ制御の実装
  const [, drag] = useDrag(
    {
      type: "NODE",
      item: { name: node.name, dir: node.dir },
    },
    [node]
  );

  const [, drop] = useDrop(
    {
      accept: "NODE",
      drop() {
        console.log("dropped!");
      },
    },
    [node]
  );

  return (
    <div>
      <div
        ref={drag}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        className={`tree-node ${expanded ? "expanded" : ""} ${
          isDragging ? "dragged" : ""
        }`}
        onClick={handleNodeClick}
      >
        {isFirstSibling && (
        <div
          ref={drop}
          className={`insert-bar before
          ${isDraggingGlobal && !isDragging ? "droppable" : ""}
          ${isDraggedOverBefore ? "dropping" : ""}`}
          onDragEnter={handleDragEnterBefore}
          onDragLeave={handleDragLeaveBefore}
        ></div>
          )}
        <div
          className={`tree-label ${!node.children ? "text" : ""} ${
            highlightedNode === node.dir ? "highlighted" : ""
          }`}
        >
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
            {node.children.map((child, index) => (
              <TreeView
                key={child.name}
                node={child}
                highlightedNode={highlightedNode}
                onHighlight={onHighlight}
                isDraggingGlobal={isDraggingGlobal}
                setIsDraggingGlobal={setIsDraggingGlobal}
                isFirstSibling={index === 0}
              /> 
            ))}
          </div>
        )}
        
          <div
            ref={drop}
            className={`insert-bar after
          ${isDraggingGlobal && !isDragging ? "droppable" : ""}
          ${isDraggedOverAfter ? "dropping" : ""}`}
            onDragEnter={handleDragEnterAfter}
            onDragLeave={handleDragLeaveAfter}
          ></div>
        
      </div>
    </div>
  );
};

// root.render を呼び出す
const root = ReactDOM.createRoot(document.getElementById("root")!);
root.render(<App />);
