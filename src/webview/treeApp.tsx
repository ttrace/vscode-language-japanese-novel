import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { useDrag, useDrop, DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
//  import { TreeView } from "./treeComponent";

// TypeScript の型定義
type TreeFileNode = {
  id: string;
  dir: string;
  name: string;
  length: number;
  children?: TreeFileNode[];
};

interface DropResult {
  name: "before" | "inside" | "after";
  node: TreeFileNode;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const vscode = (window as any).acquireVsCodeApi();

let isDraggingGlobal = false;

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
  // const [isDraggingGlobal, setIsDraggingGlobal] = useState(false);

  useEffect(() => {
    vscode.postMessage({ command: "loadTreeData" });

    const handleMessage = (event: MessageEvent) => {
      const message = event.data; // メッセージデータを取得
      switch (message.command) {
        case "treeData":
          setTreeData(message.data); // データセット
          console.log(message.data);
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
  // isDraggingGlobal: boolean;
  // setIsDraggingGlobal: (isDragging: boolean) => void;
  isFirstSibling: boolean;
}

const TreeView: React.FC<TreeViewProps> = ({
  node,
  highlightedNode,
  onHighlight,
  // isDraggingGlobal,
  // setIsDraggingGlobal,
  isFirstSibling,
}) => {
  // フォルダーが開いているかどうかを知るステータス（初期状態は開）
  const [expanded, setExpanded] = useState(true);
  // ドラッグ中かどうかを知るステータス（初期状態はfalse）
  const [isDragging, setIsDragging] = useState(false);
  // ドロップ対象かどうかを知るステータス（初期状態はfalce）
  const [isDraggedOverBefore, setIsDraggedOverBefore] = useState(false);
  const [isDraggedOverAfter, setIsDraggedOverAfter] = useState(false);
  const [isDraggedOverInside, setIsDraggedOverInside] = useState(false);

  const handleDragStart = () => {
    if (!isDraggingGlobal) {
      setIsDragging(true);
      isDraggingGlobal = true;
    }
  };

  const handleDragEnd = () => {
    setIsDragging(false);
    isDraggingGlobal = false;
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

  const handleDragEnterBefore = () => {
    setIsDraggedOverBefore(true);
  };

  const handleDragLeaveBefore = () => {
    setIsDraggedOverBefore(false);
  };

  const handleDragEnterInside = () => {
    setIsDraggedOverInside(true);
  };

  const handleDragLeaveInside = () => {
    setIsDraggedOverInside(false);
  };

  const handleDragEnterAfter = () => {
    setIsDraggedOverAfter(true);
  };

  const handleDragLeaveAfter = () => {
    setIsDraggedOverAfter(false);
  };

  // MARK: D&D
  // ドラッグ制御の実装
  const [, drag] = useDrag(
    {
      type: "NODE",
      item: { id: node.id, name: node.name, dir: node.dir },
      end: (item, monitor) => {
        const dropResult: DropResult | null = monitor.getDropResult();

        // ドロップ成功時の処理
        if (dropResult && item) {
          const fileTransferData = {
            movingFileId: item.id,
            movingFileDir: item.dir,
            insertPoint: dropResult.name,
            destinationId: dropResult.node.id,
            destinationPath: dropResult.node.dir,
          };
          vscode.postMessage({
            command: "moveCommmand",
            fileTransferData: fileTransferData,
          });
          console.log(
            `Move ${item.name} ${dropResult.name} to ${dropResult.node.name}`
          );
        }
        setIsDragging(false);
        isDraggingGlobal = false;
      },
    },
    [node]
  );

  const [, dropBefore] = useDrop(
    {
      accept: "NODE",
      drop: () => {
        setIsDraggedOverBefore(false);
        return { name: "before", node: node };
      },
      collect: (monitor) => ({
        isOverBefore: monitor.isOver(),
        canDropBefore: monitor.canDrop(),
      }),
    },
    [node]
  );

  const [, dropInside] = useDrop(
    {
      accept: "NODE",
      drop: () => {
        setIsDraggedOverInside(false);
        return { name: "inside", node: node };
      },
      collect: (monitor) => ({
        isOverInside: monitor.isOver(),
        canDropInside: monitor.canDrop(),
      }),
    },
    [node]
  );

  const [, dropAfter] = useDrop(
    {
      accept: "NODE",
      drop: () => {
        setIsDraggedOverAfter(false);
        return { name: "after", node: node };
      },
      collect: (monitor) => ({
        isOverAfter: monitor.isOver(),
        canDropAfter: monitor.canDrop(),
      }),
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
            ref={dropBefore}
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
                isFirstSibling={index === 0}
              />
            ))}
                    <div
          ref={dropInside}
          className={`insert-bar inside
          ${isDraggingGlobal && !isDragging ? "droppable" : ""}
          ${isDraggedOverInside ? "dropping" : ""}`}
          onDragEnter={handleDragEnterInside}
          onDragLeave={handleDragLeaveInside}
        ></div>
          </div>
        )}

        <div
          ref={dropAfter}
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
