import {
  PageProgression,
  printHTML,
  CoreViewer,
  Navigation,
  PageViewMode,
} from "@vivliostyle/core";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const vscode = (window as any).acquireVsCodeApi();

window.addEventListener("message", async (event: MessageEvent) => {
  const message = event.data;
  switch (message.command) {
    case "loadDocument":
      const documentContent = message.content;
      // HTML文字列をBlobに変換し、そのURLを生成
      const blob = new Blob([documentContent], { type: "text/html" });
      const url = URL.createObjectURL(blob);

      const linenumber = message.lineNumber;
      const positionUrl = "#l-" + linenumber;

      Viewer.loadDocument({ url });
       setTimeout(function(){
          loadInternalLine(Viewer, linenumber);
       },500);

      break;
  }
});

const config = {
  title: "My printed page",
  printCallback: (iframeWin: { print: () => any }) => iframeWin.print(), // optional: only needed if calling something other than window.print() for printing.
  errorCallback: (error: any) => console.error(error), // add errorCallback property
  hideIframe: false, // add hideIframe property
  removeIframe: true, // add removeIframe property
};

const viewer = document.getElementById("viewer");
if (!viewer) {
  throw new Error("Viewer element not found");
}

const settings = {
  viewportElement: viewer as HTMLElement,
};

const options = {
  autoResize: true,
  fitToScreen: true,
  renderAllPages: true,
  pageViewMode: "autoSpread" as PageViewMode,
};

const Viewer = new CoreViewer(settings, options);

document.addEventListener("click", (event) => {
  const page = (event.target as Element)?.closest(
    "[data-vivliostyle-spread-container]",
  );
  if (!page) return; // クリックされた要素にターゲットがない場合は終了
  const rect = page.getBoundingClientRect();
  const clickX = event.clientX - rect.left;
  const halfWidth = rect.width / 2;

  if (clickX < halfWidth) {
    // 左半分をクリックした場合
    Viewer.navigateToPage(Navigation.NEXT);
  } else {
    // 右半分をクリックした場合
    Viewer.navigateToPage(Navigation.PREVIOUS);
  }
});

document.onkeydown = (e) => {
  if (e.key === "ArrowRight") {
    Viewer.navigateToPage(Navigation.PREVIOUS);
    console.log("LR?", Viewer.getCurrentPageProgression());
    console.log(
      document?.querySelector("[data-vivliostyle-spread-container]")
        ?.childElementCount,
    );
  } else if (e.key === "ArrowLeft") {
    Viewer.navigateToPage(Navigation.NEXT);
  }
};

function loadInternalLine(view: CoreViewer, lineNumber: number) {
  console.log(`Navigating to line number: ${lineNumber}`);
  // 指定された行番号 ID の要素を探す
  const elementId = `l-${lineNumber}`;
  const targetElement = document.getElementById(elementId);

  if (!targetElement) {
    console.error(`Element with ID ${elementId} not found.`);
    return; // 要素がない場合は処理を終了
  }

  // 要素の親を探し、ページインデックスを取得
  let pageContainer = targetElement.closest(
    'div[data-vivliostyle-page-container="true"]',
  );

  if (pageContainer) {
    const pageIndex = pageContainer.getAttribute("data-vivliostyle-page-index");

    if (pageIndex !== null) {
      const pageNumber = parseInt(pageIndex, 10);
      if (!isNaN(pageNumber)) {
        // ページへの移動
        try {
          view.navigateToPage(Navigation.EPAGE, pageNumber);
          console.log(`Navigated to page index: ${pageNumber}`);
        } catch (error) {
          console.error(`Error navigating to page: ${error}`);
        }
      } else {
        console.error("Page index is not a valid number.");
      }
    } else {
      console.error("data-vivliostyle-page-index attribute not found.");
    }
  } else {
    console.error("Parent page container not found.");
  }
}
