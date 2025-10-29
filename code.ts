const blendModes: Record<string, { value: BlendMode, label: string }> = {
    "blend-normal": { value: "NORMAL", label: "Normal" },
    "blend-darken": { value: "DARKEN", label: "Darken" },
    "blend-multiply": { value: "MULTIPLY", label: "Multiply" },
    "blend-plus-darker": { value: "LINEAR_BURN", label: "Plus Darker" },
    "blend-color-burn": { value: "COLOR_BURN", label: "Color Burn" },
    "blend-lighten": { value: "LIGHTEN", label: "Lighten" },
    "blend-screen": { value: "SCREEN", label: "Screen" },
    "blend-plus-lighter": { value: "LINEAR_DODGE", label: "Plus Lighter" },
    "blend-color-dodge": { value: "COLOR_DODGE", label: "Color Dodge" },
    "blend-overlay": { value: "OVERLAY", label: "Overlay" },
    "blend-soft-light": { value: "SOFT_LIGHT", label: "Soft Light" },
    "blend-hard-light": { value: "HARD_LIGHT", label: "Hard Light" },
    "blend-difference": { value: "DIFFERENCE", label: "Difference" },
    "blend-exclusion": { value: "EXCLUSION", label: "Exclusion" },
    "blend-hue": { value: "HUE", label: "Hue" },
    "blend-saturation": { value: "SATURATION", label: "Saturation" },
    "blend-color": { value: "COLOR", label: "Color" },
    "blend-luminosity": { value: "LUMINOSITY", label: "Luminosity" }
};

const scaleModes: Record<string, { value: ImagePaint["scaleMode"], label: string }> = {
    "scale-fit": { value: "FIT", label: "Fit" },
    "scale-fill": { value: "FILL", label: "Fill" },
    "scale-crop": { value: "CROP", label: "Crop" },
    "scale-tile": { value: "TILE", label: "Tile" }
};

const selection = figma.currentPage.selection;
const adjustedNodes: SceneNode[] = [];

let settings = {
    traverseChildNodes: true,
    changeSelection: true 
};

async function loadSettings() {
    settings.traverseChildNodes = (await figma.clientStorage.getAsync('traverseChildNodes')) ?? true;
    settings.changeSelection = (await figma.clientStorage.getAsync('changeSelection')) ?? true;
};

function traverseAndApply(node: SceneNode, onNode: (node: SceneNode) => number) {
  if (!node.visible) {
    return 0;
  }
    let total = onNode(node);
    if ("children" in node) {
        for (const child of node.children) {
          if (child.visible) {
            total += traverseAndApply(child, onNode);
          }
        }
    }
    return total;
}

function setScaleMode(node: SceneNode, scaleMode: { value: ImagePaint["scaleMode"], label: string }) { 
  let updatedNodes = 0;
  if ("fills" in node && Array.isArray(node.fills)) { 
      let changed = false;
      const newFills = node.fills.map((fill) => { 
          if (fill.type === 'IMAGE' && fill.scaleMode !== scaleMode.value) { 
              updatedNodes += 1;
              changed = true;
              return { ...fill, scaleMode: scaleMode.value }; 
          } 
          return fill; 
      });
      if (changed) {
          node.fills = newFills; 
          adjustedNodes.push(node);
      }
      return updatedNodes;
  } 
  return 0; 
}; 

function setBlendMode(node: SceneNode, blendMode: { value: BlendMode, label: string }) { 
    if ("fills" in node && Array.isArray(node.fills)) { 
        let changed = false;
        const newFills = node.fills.map((fill) => { 
            if (fill.type === 'IMAGE' && fill.blendMode !== blendMode.value) {
                changed = true;
                return { ...fill, blendMode: blendMode.value }; 
            } 
            return fill; 
        });
        if (changed) {
            node.fills = newFills;
            adjustedNodes.push(node);
            return 1;
        }
      }
    return 0;
}

// Main Sequence
(async () => {
    await loadSettings();

    if (figma.command === "settings") {
      figma.showUI(__html__, { width: 300, height: 200, themeColors: true });

      figma.ui.postMessage({ type: 'load-settings', settings });

      figma.ui.onmessage = async (msg) => {
          if (msg.type === 'save') {
            figma.clientStorage.setAsync('traverseChildNodes', msg.traverseChildNodes);
            figma.clientStorage.setAsync('changeSelection', msg.changeSelection);
            console.log(await figma.clientStorage.getAsync('traverseChildNodes'));
            console.log(await figma.clientStorage.getAsync('changeSelection'));
            figma.closePlugin();
          }
          if (msg.type === 'cancel') {
            figma.closePlugin();
          }
      };
  }
  else { 
    if (selection.length === 0) {  
        figma.notify("Nothing was selected. Select some layers first."); 
    }
    if (figma.command in scaleModes) {
          const scale = scaleModes[figma.command];
          let totalChanged = 0;
          if (!settings.traverseChildNodes) {
              for (const node of selection) {
                  totalChanged += setScaleMode(node, scale);
              }
          }
          else {
            for (const node of selection) {
              totalChanged += traverseAndApply(node, (n) => setScaleMode(n, scale));
            }
          }
          figma.notify(`Adjusted ${ totalChanged } images to ${ scale.label }.`); 
    } 
    else if (figma.command in blendModes) { 
        const blend = blendModes[figma.command];
        let totalChanged = 0;
        if (!settings.traverseChildNodes) {
            for (const node of selection) {
                totalChanged += setBlendMode(node, blend);
            }
        }
        else {
            for (const node of selection) {
                totalChanged += traverseAndApply(node, (n) => setBlendMode(n, blend));
            }
        }
        figma.notify(`Set the Blend Mode to ${ blend.label } in ${ totalChanged } images.`);
    }
    if (settings.changeSelection){
      figma.currentPage.selection = adjustedNodes;
    }
    figma.closePlugin();
  }
})();